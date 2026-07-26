from datetime import date
from sqlalchemy import select
from typing import Dict, List

from ....db.session import db_session
from ....db.orm import OrderORM, OrderItemORM, ProductORM
from .models import DailyDeliveries, DeliveryOrder, DeliveryItem


async def get_daily_deliveries(delivery_date: date) -> DailyDeliveries:
    """
    Build the delivery summary of a given day.

    Only the data an employee needs to prepare the goods is selected: order id,
    order status, product name, unit and quantity. Prices, discounts and
    customers are never read from the database.

    Parameters:
    - delivery_date (date): The delivery date to summarise.

    Returns:
    - DailyDeliveries: The products to prepare, grouped by order, plus per-product totals.
    """

    # Create the database session
    async with db_session() as session:
        # Select the order lines of the day, joined with their product
        stmt = (
            select(
                OrderORM.id.label("order_id"),
                OrderORM.status.label("status"),
                ProductORM.id.label("product_id"),
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("unit"),
                OrderItemORM.quantity.label("quantity"),
            )
            .join(OrderItemORM, OrderItemORM.order_id == OrderORM.id)
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .where(OrderORM.delivery_date == delivery_date)
            .order_by(OrderORM.id.asc(), ProductORM.name.asc())
        )

        # Execute the query
        rows = (await session.execute(stmt)).all()

    # Group the lines by order, preserving the order id ordering of the query
    orders: Dict[int, DeliveryOrder] = {}

    # Accumulate the quantities of each product across every order of the day
    totals: Dict[int, DeliveryItem] = {}

    # Iterate over the retrieved rows
    for row in rows:
        # Normalise the quantity once
        quantity = float(row.quantity or 0)

        # Create the order group the first time we meet it
        order = orders.setdefault(
            int(row.order_id),
            DeliveryOrder(order_id=int(row.order_id), status=row.status, items=[])
        )

        # Append the line to its order
        order.items.append(
            DeliveryItem(
                product_id = int(row.product_id),
                product_name = row.product_name,
                unit = row.unit,
                quantity = quantity
            )
        )

        # Create the totals entry the first time we meet the product
        total = totals.setdefault(
            int(row.product_id),
            DeliveryItem(
                product_id = int(row.product_id),
                product_name = row.product_name,
                unit = row.unit,
                quantity = 0
            )
        )

        # Sum the quantity into the product total
        total.quantity = round(total.quantity + quantity, 2)

    # Sort the totals alphabetically, so the morning checklist is easy to scan
    sorted_totals: List[DeliveryItem] = sorted(totals.values(), key=lambda item: item.product_name.lower())

    # Return the summary
    return DailyDeliveries(
        delivery_date = delivery_date,
        orders = list(orders.values()),
        totals = sorted_totals
    )
