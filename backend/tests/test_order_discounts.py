"""Regression checks for discount persistence, allocation, reports, and schema upgrades."""

import unittest
import json
from decimal import Decimal
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import fitz
from fastapi import FastAPI
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.types import Message, Scope

# Never connect to the application's configured database or consume its .env.
with patch.dict('os.environ', {
    'DB_USER': 'test', 'DB_PASSWORD': 'test', 'DB_HOST': 'localhost',
    'DB_PORT': '3306', 'DB_NAME': 'test', 'SECRET_KEY': 'test',
    'REGISTRATION_PASSWORD_HASH': 'test', 'CORS_ORIGINS': '[]',
}), patch('pydantic_settings.sources.DotEnvSettingsSource._read_env_files', return_value={}):
    from app.db import BaseORM
    from app.db.orm import CustomerORM, ProductORM, OrderORM, OrderItemORM, UnitEnum
    from app.api.v1.orders import service as orders
    from app.api.v1.orders.router import router
    from app.api.v1.orders.models import OrderCreate, OrderUpdate, OrderItemCreate
    from app.api.v1.orders.pricing import calculate_order_pricing
    from app.api.v1.reports import service as reports
    from app.api.v1.reports.models import ProductSalesRequest, CustomerSalesRequest, CashflowRequest
    from app.api.v1.export.utils import iter_orders
    from app.core.context_manager import _ensure_orders_discount_type
    from app.models import ListingQueryParams


class PricingTests(unittest.TestCase):
    """Exercise monetary edge cases independently of persistence."""

    def test_modes_and_fixed_discount_after_quantity_change(self) -> None:
        self.assertEqual(calculate_order_pricing([(1, 200)], 10).total, Decimal('180.00'))
        self.assertEqual(calculate_order_pricing([(1, 200)], 20, 'fixed').total, Decimal('180.00'))
        self.assertEqual(calculate_order_pricing([(1.5, 200)], 20, 'fixed').total, Decimal('280.00'))
        self.assertEqual(calculate_order_pricing([(1.5, 200)], 10).total, Decimal('270.00'))

    def test_allocation_preserves_total_and_half_up_rounding(self) -> None:
        pricing = calculate_order_pricing([(1, 1)] * 3, 1, 'fixed')
        self.assertEqual(pricing.line_totals, (Decimal('.67'), Decimal('.66'), Decimal('.67')))
        self.assertEqual(sum(pricing.line_totals), pricing.total)
        self.assertEqual(calculate_order_pricing([(1, .05)], 10).total, Decimal('.05'))
        self.assertEqual(calculate_order_pricing([(1, 1)], 100).total, 0)
        self.assertEqual(calculate_order_pricing([(1, 1)], 1, 'fixed').total, 0)
        self.assertEqual(calculate_order_pricing([], 0, 'fixed').total, 0)

    def test_invalid_discount_values(self) -> None:
        for value, mode in [(-1, 'fixed'), (101, 'percentage'), (1.01, 'fixed'), (float('nan'), 'fixed'), (0.001, 'fixed'), (1e100, 'fixed')]:
            with self.subTest(value=value, mode=mode), self.assertRaises(ValueError):
                calculate_order_pricing([(1, 1)], value, mode)
        with self.assertRaises(ValidationError):
            OrderUpdate(discount_type='invalid')
        with self.assertRaises(ValidationError):
            OrderUpdate(applied_discount=float('inf'))
        with self.assertRaises(ValidationError):
            OrderUpdate(applied_discount=1.001)
        with self.assertRaises(ValidationError):
            OrderUpdate(applied_discount=1e100)

    def test_full_price_cents_are_independent_of_the_discount(self) -> None:
        lines = [(.25, 3.50), (.25, 3.50)]
        regular = calculate_order_pricing(lines)
        discounted = calculate_order_pricing(lines, .05, 'fixed')
        self.assertEqual(sum(discounted.gross_line_totals), discounted.subtotal)
        self.assertEqual(discounted.gross_line_totals, regular.gross_line_totals)
        self.assertEqual(discounted.total, Decimal('1.70'))


class DiscountServiceTests(unittest.IsolatedAsyncioTestCase):
    """Run real services and SQL queries on an isolated SQLite fixture database."""

    def setUp(self) -> None:
        self.app = FastAPI()
        self.app.include_router(router, prefix='/api')
        self.engine = create_engine('sqlite://')
        with self.engine.connect() as connection:
            connection.exec_driver_sql('PRAGMA foreign_keys = ON')
        BaseORM.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add(CustomerORM(id=1, name='Test customer'))
            session.add_all([
                ProductORM(id=1, name='A', unit_price=100, unit=UnitEnum.PX),
                ProductORM(id=2, name='B', unit_price=100, unit=UnitEnum.PX),
                ProductORM(id=3, name='C', unit_price=1, unit=UnitEnum.PX),
            ])
            session.commit()

        @asynccontextmanager
        async def fixture_session() -> AsyncIterator[AsyncSession]:
            with Session(self.engine, autoflush=False) as session:
                adapter = AsyncMock(spec=AsyncSession)
                for name in ('execute', 'scalars', 'scalar', 'get', 'commit', 'refresh', 'delete'):
                    getattr(adapter, name).side_effect = getattr(session, name)
                adapter.add.side_effect = session.add
                yield adapter

        self.fixture_session = fixture_session
        for module in (orders, reports):
            patcher = patch.object(module, 'db_session', fixture_session)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.engine.dispose)

    async def request(self, method: str, path: str, body: str = '') -> tuple[int, dict]:
        """Exercise the real FastAPI router without a network or HTTP client dependency."""

        messages: list[Message] = []
        scope: Scope = {
            'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
            'method': method, 'path': path, 'raw_path': path.encode(),
            'query_string': b'', 'root_path': '', 'scheme': 'http',
            'headers': [(b'content-type', b'application/json')],
            'server': ('test', 80), 'client': ('test', 1),
        }

        async def receive() -> Message:
            return {'type': 'http.request', 'body': body.encode(), 'more_body': False}

        async def send(message: Message) -> None:
            messages.append(message)

        await self.app(scope, receive, send)
        status = next(message['status'] for message in messages if message['type'] == 'http.response.start')
        response = b''.join(message.get('body', b'') for message in messages if message['type'] == 'http.response.body')
        return status, json.loads(response)

    async def test_api_contract_and_validation(self) -> None:
        order = await self.create()
        status, response = await self.request('GET', f'/api/orders/{order.id}')
        self.assertEqual(status, 200)
        self.assertEqual(response['data']['discount_type'], 'fixed')
        self.assertEqual(response['data']['discount_amount'], 20)
        self.assertEqual(response['data']['items'][0]['net_amount'], 90)
        self.assertEqual(response['data']['items'][0]['gross_amount'], 100)
        self.assertEqual(response['data']['items'][0]['unit_price'], 100)
        for body, expected_status in [
            ('{"applied_discount": 201}', 400),
            ('{"discount_type": "percentage", "applied_discount": 101}', 400),
            ('{"applied_discount": -1}', 422),
            ('{"discount_type": "unknown"}', 422),
        ]:
            status, _ = await self.request('PATCH', f'/api/orders/{order.id}', body)
            self.assertEqual(status, expected_status)

    async def create(self, discount: float = 20, mode: str = 'fixed') -> orders.Order:
        """Create an order using catalog snapshot prices."""

        payload = OrderCreate.model_validate({
            'customer_id': 1, 'delivery_date': '2026-10-20',
            'applied_discount': discount, 'discount_type': mode,
            'items': [{'product_id': 1, 'quantity': 1}, {'product_id': 2, 'quantity': 1}],
        })
        order = await orders.create_order(payload)
        assert order is not None
        return order

    async def test_create_list_and_partial_updates(self) -> None:
        order = await self.create()
        self.assertEqual(order.total_amount, 180)
        self.assertEqual(order.discount_type, 'fixed')
        self.assertEqual([item.net_amount for item in order.items], [90, 90])
        listing = await orders.list_orders(ListingQueryParams(page=1, size=10))
        self.assertEqual(listing.items[0].total_amount, 180)

        updated = await orders.update_order(order.id, OrderUpdate(items=[
            OrderItemCreate(product_id=1, quantity=2), OrderItemCreate(product_id=2, quantity=1),
        ]))
        assert updated is not None
        self.assertEqual(updated.total_amount, 280)
        self.assertEqual(updated.applied_discount, 20)
        updated = await orders.update_order(order.id, OrderUpdate(status='delivered'))
        assert updated is not None
        self.assertEqual(updated.discount_type, 'fixed')
        updated = await orders.update_order(order.id, OrderUpdate(discount_type='percentage', applied_discount=10))
        assert updated is not None
        self.assertEqual(updated.total_amount, 270)
        updated = await orders.update_order(order.id, OrderUpdate(applied_discount=0))
        assert updated is not None
        self.assertEqual(updated.total_amount, 300)

    async def test_rejected_updates_are_atomic(self) -> None:
        order = await self.create(150)
        for payload in [
            OrderUpdate(applied_discount=201),
            OrderUpdate(discount_type='percentage'),
            OrderUpdate(items=[OrderItemCreate(product_id=1, quantity=1)], note='should roll back'),
        ]:
            with self.assertRaises(ValueError):
                await orders.update_order(order.id, payload)
            unchanged = await orders.get_order_by_id(order.id)
            assert unchanged is not None
            self.assertEqual(unchanged.total_amount, 50)
            self.assertIsNone(unchanged.note)
            self.assertEqual(len(unchanged.items), 2)
        with self.assertRaises(ValueError):
            await self.create(201)
        with self.assertRaises(ValueError):
            await self.create(101, 'percentage')
        with Session(self.engine) as session:
            self.assertEqual(len(session.scalars(select(OrderORM)).all()), 1)

    async def test_legacy_percentage_and_reports(self) -> None:
        legacy = OrderCreate(customer_id=1, delivery_date=date(2026, 10, 20), applied_discount=10,
                             items=[OrderItemCreate(product_id=1, quantity=1)])
        old = await orders.create_order(legacy)
        assert old is not None
        self.assertEqual(old.discount_type, 'percentage')
        self.assertEqual(old.total_amount, 90)
        fixed = await self.create()
        await orders.update_order(fixed.id, OrderUpdate(status='delivered'))
        period = {'start_date': '2026-10-20', 'end_date': '2026-10-20'}
        products = await reports.report_product_sales(ProductSalesRequest(**period))
        self.assertEqual(sum(row.revenue for row in products), 270)
        customer = await reports.report_customer_sales(CustomerSalesRequest(customer_id=1, **period))
        self.assertEqual(customer.total_revenue, 270)
        self.assertTrue(all(row.avg_discount == 10 for row in customer.per_product))
        filtered = await reports.report_product_sales(ProductSalesRequest(product_ids=[2], **period))
        self.assertEqual(filtered[0].revenue, 90)
        cash = await reports.report_cashflow(CashflowRequest(**period))
        self.assertEqual(cash.entries_total, 180)

    async def test_residual_cents_match_reports_and_export(self) -> None:
        payload = OrderCreate(customer_id=1, delivery_date=date(2026, 10, 20), applied_discount=1,
                             discount_type='fixed', items=[
                                 OrderItemCreate(product_id=pid, quantity=1, unit_price=1) for pid in (1, 2, 3)
                             ])
        order = await orders.create_order(payload)
        assert order is not None
        rows = await reports.report_product_sales(ProductSalesRequest(
            start_date=date(2026, 10, 20), end_date=date(2026, 10, 20),
        ))
        self.assertEqual([row.revenue for row in rows], [item.net_amount for item in order.items])
        self.assertEqual(round(sum(row.revenue for row in rows), 2), 2)
        async with self.fixture_session() as session:
            batches = [batch async for batch in iter_orders(session, None, None)]
        self.assertEqual(batches[0][0][4:6], [Decimal('1.00'), '€'])

    async def test_ddt_keeps_full_line_amounts_and_separates_discount(self) -> None:
        order = await self.create()
        with TemporaryDirectory() as folder:
            target = Path(folder) / 'order.pdf'
            with patch.object(orders, 'format_it_number', wraps=orders.format_it_number) as formatter:
                await orders.generate_ddt_pdf(order.id, str(target))
                amounts = [call.args[0] for call in formatter.call_args_list]
                self.assertEqual(amounts.count(100), 2)
                self.assertNotIn(90, amounts)
                self.assertIn(200, amounts)
                self.assertIn(20, amounts)
                self.assertIn(180, amounts)
            self.assertTrue(target.read_bytes().startswith(b'%PDF'))

    async def test_ddt_summary_for_euro_percent_and_no_discount(self) -> None:
        original_update = fitz.Widget.update
        fields: dict[str, str] = {}

        def capture_field(widget: fitz.Widget) -> None:
            if widget.field_name:
                fields[widget.field_name] = widget.field_value
            original_update(widget)

        for mode, discount, expected_total in [('fixed', 5.95, '194,05'), ('percentage', 10, '180,00'), ('fixed', 0, '200,00')]:
            with self.subTest(mode=mode, discount=discount), TemporaryDirectory() as folder:
                order = await self.create(discount, mode)
                fields.clear()
                with patch.object(fitz.Widget, 'update', capture_field):
                    await orders.generate_ddt_pdf(order.id, str(Path(folder) / 'order.pdf'))
                self.assertEqual(fields['Text10'], '100,00')
                self.assertEqual(fields['Text13'], '100,00')
                self.assertIn(f'Totale (€): {expected_total}', fields['Text64'])
                if discount:
                    self.assertIn('Subtotale (€): 200,00', fields['Text64'])
                    self.assertIn("Sconto sull'ordine (€): -", fields['Text64'])
                else:
                    self.assertEqual(fields['Text64'], 'Totale (€): 200,00')

    async def test_fractional_quantities_match_report_rounding(self) -> None:
        for mode, discount in [('percentage', 10), ('fixed', .01)]:
            with self.subTest(mode=mode):
                order = await orders.create_order(OrderCreate(
                    customer_id = 1,
                    delivery_date = date(2026, 10, 20),
                    applied_discount = discount,
                    discount_type = mode,
                    items = [
                        OrderItemCreate(product_id=1, quantity=.5, unit_price=.05),
                        OrderItemCreate(product_id=2, quantity=1, unit_price=.05),
                    ],
                ))
                assert order is not None
                rows = await reports.report_product_sales(ProductSalesRequest(
                    start_date = date(2026, 10, 20),
                    end_date = date(2026, 10, 20),
                ))
                self.assertEqual([row.revenue for row in rows], [item.net_amount for item in order.items])
                self.assertEqual(round(sum(row.revenue for row in rows), 2), order.total_amount)
                await orders.delete_order(order.id)

    async def test_duplicate_fractional_quantities_do_not_lose_a_cent(self) -> None:
        order = await orders.create_order(OrderCreate(
            customer_id = 1,
            delivery_date = date(2026, 10, 20),
            items = [
                OrderItemCreate(product_id=1, quantity=.3, unit_price=.05),
                OrderItemCreate(product_id=1, quantity=.6, unit_price=.05),
            ],
        ))
        assert order is not None
        self.assertEqual(order.total_amount, .05)
        self.assertEqual(order.items[0].quantity, .9)
        rows = await reports.report_product_sales(ProductSalesRequest(
            start_date = date(2026, 10, 20),
            end_date = date(2026, 10, 20),
        ))
        self.assertEqual(rows[0].revenue, order.total_amount)


class MigrationTests(unittest.IsolatedAsyncioTestCase):
    """Check restartable migration steps without modifying a real database."""

    async def test_upgrade_and_repeated_startup(self) -> None:
        connection = AsyncMock()
        connection.scalar.return_value = 0
        # execute() returns a synchronous SQLAlchemy result.
        result = MagicMock()
        result.scalars.return_value = ['check_applied_discount']
        connection.execute.return_value = result
        await _ensure_orders_discount_type(connection)
        sql = [str(call.args[0]) for call in connection.execute.await_args_list]
        self.assertTrue(any('ADD COLUMN' in statement for statement in sql))
        self.assertTrue(any('DROP CHECK check_applied_discount' in statement for statement in sql))
        self.assertEqual(sum('ADD CONSTRAINT' in statement for statement in sql), 2)

        connection.reset_mock()
        connection.scalar.return_value = 1
        result.scalars.return_value = ['check_order_discount_value', 'check_order_discount_type']
        await _ensure_orders_discount_type(connection)
        self.assertEqual(connection.execute.await_count, 1)

        # Recover if a previous startup stopped after dropping the legacy check.
        connection.reset_mock()
        result.scalars.return_value = []
        await _ensure_orders_discount_type(connection)
        self.assertEqual(connection.execute.await_count, 3)


if __name__ == '__main__':
    unittest.main()
