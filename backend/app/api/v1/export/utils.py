from datetime import date
from typing import Optional, AsyncGenerator

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ....db.orm.lot import LotORM
from ....core.config import settings
from ....db.orm import (
    NoteORM,
    OrderORM,
    IncomeORM,
    ExpenseORM,
    ProductORM,
    CustomerORM,
    OrderItemORM,
    IncomesCategoryORM,
    ExpenseCategoryORM
)


async def iter_customers(session: AsyncSession) -> AsyncGenerator[list[list], None]:
    """
    Yield customers in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    offset = 0
    while True:
        result = await session.execute(
            select(CustomerORM)
            .order_by(CustomerORM.id)
            .offset(offset)
            .limit(settings.export_batch_size)
        )
        rows = result.scalars().all()
        if not rows:
            break
        yield [[r.id, r.name, r.is_active] for r in rows]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_products(session: AsyncSession) -> AsyncGenerator[list[list], None]:
    """
    Yield products in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    offset = 0
    while True:
        result = await session.execute(
            select(ProductORM)
            .order_by(ProductORM.id)
            .offset(offset)
            .limit(settings.export_batch_size)
        )
        rows = result.scalars().all()
        if not rows:
            break
        yield [[r.id, r.name, r.unit_price, r.unit.value, r.is_active] for r in rows]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_orders(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield orders in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on delivery_date.
    - end_date (Optional[date]): Optional upper bound on delivery_date.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement for orders joined with customers
    stmt = (
        select(OrderORM, CustomerORM.name.label("customer_name"))
        .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
        .order_by(OrderORM.id)
    )
    if start_date:
        stmt = stmt.where(OrderORM.delivery_date >= start_date)
    if end_date:
        stmt = stmt.where(OrderORM.delivery_date <= end_date)

    # Fetch orders in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.all()
        if not rows:
            break
        yield [
            [
                r.OrderORM.id,
                r.customer_name,
                r.OrderORM.delivery_date,
                r.OrderORM.created_at,
                r.OrderORM.applied_discount,
                r.OrderORM.status,
                r.OrderORM.note
            ]
            for r in rows
        ]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_order_items(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield order items in batches, ordered by id.
    Joins with OrderORM to apply the same date filters used for orders,
    and with ProductORM to include the product name instead of a bare id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on the parent order's delivery_date.
    - end_date (Optional[date]): Optional upper bound on the parent order's delivery_date.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement for order items joined with orders and products
    stmt = (
        select(OrderItemORM, ProductORM.name.label("product_name"))
        .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
        .join(OrderORM, OrderORM.id == OrderItemORM.order_id)
        .order_by(OrderItemORM.id)
    )
    if start_date:
        stmt = stmt.where(OrderORM.delivery_date >= start_date)
    if end_date:
        stmt = stmt.where(OrderORM.delivery_date <= end_date)

    # Fetch order items in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.all()
        if not rows:
            break
        yield [
            [
                r.OrderItemORM.id,
                r.OrderItemORM.order_id,
                r.product_name,
                r.OrderItemORM.quantity,
                r.OrderItemORM.unit_price,
                r.OrderItemORM.lot_id,
            ]
            for r in rows
        ]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_expenses(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield expenses in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on timestamp.
    - end_date (Optional[date]): Optional upper bound on timestamp.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement for expenses joined with categories
    stmt = (
        select(ExpenseORM, ExpenseCategoryORM.descr.label("category"))
        .join(ExpenseCategoryORM, ExpenseCategoryORM.id == ExpenseORM.category_id)
        .order_by(ExpenseORM.id)
    )
    if start_date:
        stmt = stmt.where(ExpenseORM.timestamp >= start_date)
    if end_date:
        stmt = stmt.where(ExpenseORM.timestamp <= end_date)

    # Fetch expenses in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.all()
        if not rows:
            break
        yield [
            [
                r.ExpenseORM.id, 
                r.category, 
                r.ExpenseORM.timestamp, 
                r.ExpenseORM.amount, 
                r.ExpenseORM.note
            ]
            for r in rows
        ]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_incomes(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield incomes in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on timestamp.
    - end_date (Optional[date]): Optional upper bound on timestamp.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement for incomes joined with categories
    stmt = (
        select(IncomeORM, IncomesCategoryORM.descr.label("category"))
        .join(IncomesCategoryORM, IncomesCategoryORM.id == IncomeORM.category_id)
        .order_by(IncomeORM.id)
    )
    if start_date:
        stmt = stmt.where(IncomeORM.timestamp >= start_date)
    if end_date:
        stmt = stmt.where(IncomeORM.timestamp <= end_date)

    # Fetch incomes in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.all()
        if not rows:
            break
        yield [
            [
                r.IncomeORM.id, 
                r.category, 
                r.IncomeORM.timestamp, 
                r.IncomeORM.amount, 
                r.IncomeORM.note
            ]
            for r in rows
        ]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_lots(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield lots in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on lot_date.
    - end_date (Optional[date]): Optional upper bound on lot_date.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement with optional date filters
    stmt = select(LotORM).order_by(LotORM.id)
    if start_date:
        stmt = stmt.where(LotORM.lot_date >= start_date)
    if end_date:
        stmt = stmt.where(LotORM.lot_date <= end_date)

    # Fetch lots in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.scalars().all()
        if not rows:
            break
        yield [[r.id, r.name, r.lot_date, r.location, r.description] for r in rows]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size


async def iter_notes(
    session: AsyncSession,
    start_date: Optional[date],
    end_date: Optional[date],
) -> AsyncGenerator[list[list], None]:
    """
    Yield notes in batches, ordered by id.

    Parameters:
    - session (AsyncSession): The database session.
    - start_date (Optional[date]): Optional lower bound on created_at.
    - end_date (Optional[date]): Optional upper bound on created_at.

    Returns:
    - AsyncGenerator[list[list], None]: An async generator yielding batches of rows.
    """

    # Build the base statement with optional date filters
    stmt = select(NoteORM).order_by(NoteORM.id)
    if start_date:
        stmt = stmt.where(func.date(NoteORM.created_at) >= start_date)
    if end_date:
        stmt = stmt.where(func.date(NoteORM.created_at) <= end_date)

    # Fetch notes in batches
    offset = 0
    while True:
        result = await session.execute(stmt.offset(offset).limit(settings.export_batch_size))
        rows = result.scalars().all()
        if not rows:
            break
        yield [[r.id, r.text, r.created_at, r.updated_at] for r in rows]
        if len(rows) < settings.export_batch_size:
            break
        offset += settings.export_batch_size
