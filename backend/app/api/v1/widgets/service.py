from datetime import date
from typing import Dict, List
from collections import defaultdict
from sqlalchemy import select, func

from ....db.session import db_session
from ....db.orm import OrderORM, OrderItemORM, ProductORM, CustomerORM

from .models import (
    DailySummaryRequest,
    DailySummary,
    DailyProductSummary,
    DailyCustomerBreakdown
)


async def daily_summary(payload: DailySummaryRequest) -> List[DailySummary]:
    """
    Service to get the daily summary of orders.

    Parameters:
    - payload: The request payload containing the date range for the summary.

    Returns:
    - A list of daily summaries for the specified date range.
    """

    # Create the database session
    async with db_session() as session:
        # Create the query statement to get daily product totals
        totals_stmt = (
            select(
                OrderORM.delivery_date.label("day"),
                ProductORM.id.label("product_id"),
                ProductORM.unit.label("product_unit"),
                ProductORM.name.label("product_name"),
                func.sum(OrderItemORM.quantity).label("total_qty"),
            )
            .join(OrderItemORM, OrderItemORM.order_id == OrderORM.id)
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .where(OrderORM.delivery_date.between(payload.start_date, payload.end_date))
            .group_by(OrderORM.delivery_date, ProductORM.id, ProductORM.name)
            .order_by(OrderORM.delivery_date.asc(), ProductORM.name.asc())
        )

        # Execute the query and fetch results
        totals_res = await session.execute(totals_stmt)
        totals_rows = totals_res.all()

        # Create the query statement to get daily product customer breakdown
        details_stmt = (
            select(
                OrderORM.delivery_date.label("day"),
                ProductORM.id.label("product_id"),
                CustomerORM.id.label("customer_id"),
                CustomerORM.name.label("customer_name"),
                OrderORM.status.label("order_status"),
                func.sum(OrderItemORM.quantity).label("qty"),
            )
            .join(OrderItemORM, OrderItemORM.order_id == OrderORM.id)
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
            .where(OrderORM.delivery_date.between(payload.start_date, payload.end_date))
            .group_by(
                OrderORM.delivery_date,
                ProductORM.id,
                CustomerORM.id,
                CustomerORM.name,
                OrderORM.status,
            )
            .order_by(
                OrderORM.delivery_date.asc(),
                ProductORM.name.asc(),
                CustomerORM.name.asc(),
                OrderORM.status.asc(),
            )
        )

        # Execute the query and fetch results
        details_res = await session.execute(details_stmt)
        details_rows = details_res.all()

        # Bucket: (day, product_id) -> list[DailyCustomerBreakdown]
        breakdown_map: Dict[tuple, List[DailyCustomerBreakdown]] = defaultdict(list)
        for r in details_rows:
            breakdown_map[(r.day, int(r.product_id))].append(
                DailyCustomerBreakdown(
                    customer_id = int(r.customer_id),
                    customer_name = r.customer_name,
                    order_status = str(r.order_status),
                    quantity = round(float(r.qty or 0.0), 2)
                )
            )

        # Bucket: day -> list[DailyProductSummary]
        products_by_day: Dict[object, List[DailyProductSummary]] = defaultdict(list)
        for r in totals_rows:
            key = (r.day, int(r.product_id))
            products_by_day[r.day].append(
                DailyProductSummary(
                    product_id = int(r.product_id),
                    product_name = r.product_name,
                    total_qty = round(float(r.total_qty or 0.0), 2),
                    product_unit = r.product_unit,
                    customers = breakdown_map.get(key, [])
                )
            )

        # Order the products of each day by name (already sorted by the query, but ensure stability)
        for _, lst in products_by_day.items():
            lst.sort(key=lambda p: p.product_name.lower())

        # Build the ordered response by day
        days_sorted = sorted(products_by_day.keys(), key=lambda d: str(d))
        
        # Return the list of DailySummary objects
        return [
            DailySummary(
                date = day if isinstance(day, date) else date.fromisoformat(str(day)),
                products = products_by_day[day]
            )
            for day in days_sorted
        ]