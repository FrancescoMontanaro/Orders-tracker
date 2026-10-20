"""SQL counterpart of order pricing for aggregate reports."""

from datetime import date

from sqlalchemy import Numeric, case, cast, func, select
from sqlalchemy.sql.selectable import Subquery

from ....db.orm import OrderORM, OrderItemORM


def priced_order_items(
    start_date: date,
    end_date: date,
    customer_id: int | None = None,
) -> Subquery:
    """Allocate order totals before report filters, preserving residual cents.

    Window functions include every line of each order even when a report later
    selects only one product. Item ID matches the API and DDT allocation order.
    """

    amount = cast(OrderItemORM.quantity, Numeric(30, 12)) * OrderItemORM.unit_price
    statement = select(
        OrderItemORM.id.label("item_id"),
        amount.label("gross"),
        OrderORM.applied_discount.label("discount"),
        OrderORM.discount_type,
        func.sum(amount).over(partition_by = OrderORM.id).label("subtotal"),
        func.sum(amount).over(
            partition_by = OrderORM.id,
            order_by = OrderItemORM.id,
            rows = (None, 0),
        ).label("cumulative"),
    ).join(OrderORM, OrderORM.id == OrderItemORM.order_id).where(
        OrderORM.delivery_date.between(start_date, end_date)
    )
    if customer_id is not None:
        statement = statement.where(OrderORM.customer_id == customer_id)
    lines = statement.subquery()

    total = func.round(case(
        (lines.c.discount_type == "fixed", lines.c.subtotal - lines.c.discount),
        else_ = lines.c.subtotal * (1 - lines.c.discount / 100),
    ), 2)
    denominator = func.nullif(lines.c.subtotal, 0)
    net_amount = (
        func.round(lines.c.cumulative * total / denominator, 2)
        - func.round((lines.c.cumulative - lines.c.gross) * total / denominator, 2)
    )
    effective_discount = case(
        (lines.c.discount_type == "fixed", lines.c.discount * 100 / denominator),
        else_ = lines.c.discount,
    )
    return select(
        lines.c.item_id,
        func.coalesce(net_amount, 0).label("net_amount"),
        func.coalesce(effective_discount, 0).label("effective_discount"),
    ).subquery("priced_items")
