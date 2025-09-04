from datetime import date
from typing import Optional, Dict, List
from sqlalchemy import select, delete, asc, desc, func

from ....db.session import db_session
from ....db.orm.product import ProductORM
from ....db.orm.customer import CustomerORM
from .constants import ALLOWED_SORTING_FIELDS
from ....db.orm import OrderORM, OrderItemORM
from ....models import Pagination, ListingQueryParams
from .models import Order, OrderCreate, OrderUpdate, OrderItem


async def list_orders(params: ListingQueryParams) -> Pagination[Order]:
    """
    List orders with pagination/filter/sort

    Parameters:
    - params (ListingQueryParams): The query parameters for listing orders.

    Returns:
    - Pagination[Order]: The paginated list of orders with customer_name and items.
    """

    # Compute the pagination parameters
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    # Create the database session
    async with db_session() as session:
        # Create the base statement to fetch orders with customer names
        stmt = (
            select(
                OrderORM,
                CustomerORM.name.label("customer_name"),
            )
            .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
        )

        # Apply filters
        filters: Dict[str, str] = params.filters or {}

        # Iterate over the filters and apply them to the query
        for field, value in filters.items():
            # Skip None values and unknown fields
            if value is None:
                continue

            # Skip unknown fields
            if field not in ALLOWED_SORTING_FIELDS:
                continue

            # Map the field to the corresponding column
            col = ALLOWED_SORTING_FIELDS[field]

            # field-specific parsing
            if field in ("id", "customer_id"):
                try:
                    ivalue = int(value)
                except (TypeError, ValueError):
                    # Force no match
                    stmt = stmt.where(col == -1)
                    continue

                # Apply the filter
                stmt = stmt.where(col == ivalue)

            # Delivery date after
            elif field == "delivery_date_after":
                try:
                    # Parse the date
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    # Force no match
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue

                # Apply the filter
                stmt = stmt.where(col >= dvalue)

            # Delivery date before
            elif field == "delivery_date_before":
                try:
                    # Parse the date
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    # Force no match
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue

                # Apply the filter
                stmt = stmt.where(col <= dvalue)

            # Other fields
            else:
                # Apply the default text filter (e.g. customer_name)
                stmt = stmt.where(col.ilike(f"%{value}%"))

        # Count the total number of matching orders
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Apply sorting
        if params.sort:
            # Map sorting fields
            order_clauses = []

            # Map sorting fields
            for s in params.sort:
                # Extract sorting field and order
                field = s.field
                order = (s.order or "asc").lower()

                # Map sorting fields
                if field in ALLOWED_SORTING_FIELDS:
                    # Map the field to the corresponding column
                    col = ALLOWED_SORTING_FIELDS[field]

                    # Apply sorting
                    order_clauses.append(desc(col) if order == "desc" else asc(col))

            # Check if there are any order clauses
            if order_clauses:
                # Apply sorting
                stmt = stmt.order_by(*order_clauses)

        # Apply pagination only if size is or equal than zero
        if size >= 0: stmt = stmt.offset(offset).limit(size)

        # Execute the query
        res = await session.execute(stmt)

        # Get all rows
        rows = res.all()

        # Create lists for orders and order IDs
        orders: List[Order] = []
        order_ids: List[int] = []

        # Iterate over the rows and map them to the Order model
        for order_orm, customer_name in rows:
            # Map the order and customer name to the Order model
            o = Order.model_validate({
                **order_orm.__dict__,
                "total_amount": 0.0, # Initial value
                "customer_name": customer_name,
                "items": []
            })

            # Append the order and ID to the respective lists
            orders.append(o)
            order_ids.append(o.id)

        # If there are no orders on the page, return immediately
        if not order_ids:
            # No orders found
            return Pagination(total=total, items=[])

        # Fetch order items for all order IDs
        items_stmt = (
            select(
                OrderItemORM, 
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("unit")
            )
            .where(OrderItemORM.order_id.in_(order_ids))
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
        )

        # Execute the query and extract the results
        items_res = await session.execute(items_stmt)
        items_rows = items_res.fetchall()

        # Create a list for items by order
        items_by_order: Dict[int, List[OrderItem]] = {}

        # Map each item to its order
        for item, product_name, unit in items_rows:
            # Validate and map the item
            pyd = OrderItem.model_validate({
                **item.__dict__,
                "product_name": product_name,
                "unit": unit
            })

            # Append the item to the list for its order
            items_by_order.setdefault(item.order_id, []).append(pyd)

        # Attach items to each order
        for o in orders:
            # Map the items to the order
            o.items = items_by_order.get(o.id, [])

            # Compute subtotal and total amount
            subtotal = sum(it.quantity * it.unit_price for it in o.items)
            o.total_amount = round(subtotal * (1 - (o.applied_discount or 0) / 100), 2)

        # Return the paginated result
        return Pagination(total=total, items=orders)


async def get_order_by_id(order_id: int) -> Optional[Order]:
    """
    Get a single order from the database by its ID.

    Params:
    - order_id (int): The ID of the order to retrieve.

    Returns:
    - Optional[Order]: The order if found, None otherwise.
    """

    # Create a new database session
    async with db_session() as session:
        # Get the order and join with customer
        stmt = (
            select(OrderORM, CustomerORM.name.label("customer_name"))
            .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
            .where(OrderORM.id == order_id)
        )

        # Execute the query
        res = await session.execute(stmt)

        # Get the first result
        row = res.first()

        # Check if the order exists
        if not row:
            return None

        # Unpack the order and customer and map the result to the Order model
        order_orm, customer_name = row
        order = Order.model_validate({
            **order_orm.__dict__,
            "total_amount": 0.0,
            "customer_name": customer_name,
            "items": []
        })

        # Extract order items
        items_stmt = (
            select(
                OrderItemORM,
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("unit")
            )
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .where(OrderItemORM.order_id == order.id)
        )

        # Execute the query
        result = await session.execute(items_stmt)

        # Map the result to the OrderItem model
        order_items = result.all()

        # Validate and map the order items
        for item, product_name, unit in order_items:
            # Validate and map the item
            pyd = OrderItem.model_validate({
                **item.__dict__,
                "product_name": product_name,
                "unit": unit
            })

            # Append the item to the order
            order.items.append(pyd)

        # Compute subtotal and total amount
        subtotal = sum(it.quantity * it.unit_price for it in order.items)
        order.total_amount = round(subtotal * (1 - (order.applied_discount or 0) / 100), 2)

        # Return the complete order
        return order


async def create_order(payload: OrderCreate) -> Optional[Order]:
    """
    Create order with items, snapshot unit_price, compute total.

    Params:
    - payload (OrderCreate): The order data to create.

    Returns:
    - Order: The created order.
    """

    # Create a new database session
    async with db_session() as session:
        # Validate customer
        if not await session.get(CustomerORM, payload.customer_id):
            raise ValueError("Customer not found")

        # Prepare items and total (merge duplicates)
        items_orm: list[OrderItemORM] = []
        total = 0.0

        # Aggregate quantities by product_id
        agg: Dict[int, Dict] = {}
        for it in payload.items:
            agg[it.product_id] = agg.get(it.product_id, {"quantity": 0.0, "unit_price": None})
            agg[it.product_id]["quantity"] += float(it.quantity)
            agg[it.product_id]["unit_price"] = float(it.unit_price) if it.unit_price else None

        # Build unique rows using snapshot unit_price
        for pid, data in agg.items():
            prod = await session.get(ProductORM, pid)
            if not prod:
                raise ValueError(f"Product {pid} not found")
            unit_price = float(prod.unit_price) if data["unit_price"] is None else data["unit_price"]
            total += unit_price * data["quantity"]
            items_orm.append(
                OrderItemORM(product_id=pid, quantity=data["quantity"], unit_price=unit_price)
            )

        # Create the order
        order_orm = OrderORM(
            customer_id = payload.customer_id,
            delivery_date = payload.delivery_date,
            applied_discount = payload.applied_discount,
            items = items_orm
        )

        # Add the order to the session
        session.add(order_orm)

        # Commit the transaction
        await session.commit()
        await session.refresh(order_orm)

    # Return the created order
    return await get_order_by_id(order_orm.id)


async def update_order(order_id: int, payload: OrderUpdate) -> Optional[Order]:
    """
    Update order; if items provided, replace all items and recompute total.

    Params:
    - order_id (int): The ID of the order to update.
    - payload (OrderUpdate): The updated order data.

    Returns:
    - Optional[Order]: The updated order, or None if not found.
    """

    # Create a new database session
    async with db_session() as session:
        # Load the order
        res = await session.execute(select(OrderORM).where(OrderORM.id == order_id))
        order_orm = res.scalar_one_or_none()
        if not order_orm:
            return None

        # Update simple fields
        if payload.delivery_date is not None:
            order_orm.delivery_date = payload.delivery_date
        if payload.status is not None:
            order_orm.status = payload.status

        # Replace items if provided
        if payload.items is not None:
            # Lock the existing items for update
            existing_items = await session.execute(
                select(OrderItemORM)
                .where(OrderItemORM.order_id == order_orm.id)
                .with_for_update()
            )

            # Extract existing item prices
            existing_items = {item.product_id: item.unit_price for item in existing_items.scalars()}

            # Delete existing items
            await session.execute(
                delete(OrderItemORM).where(OrderItemORM.order_id == order_orm.id)
            )

            # Insert new items (snapshot unit_price) merging duplicates
            new_rows: list[OrderItemORM] = []

            # Aggregate quantities by product_id
            agg: Dict[int, Dict] = {}
            for it in payload.items:
                agg[it.product_id] = agg.get(it.product_id, {"quantity": 0.0, "unit_price": None})
                agg[it.product_id]["quantity"] += float(it.quantity)
                agg[it.product_id]["unit_price"] = float(it.unit_price) if it.unit_price else None

            # For each unique product_id pick existing unit_price or current product price
            for pid, data in agg.items():
                unit_price = existing_items.get(pid) if data["unit_price"] is None else data["unit_price"]
                if unit_price is None:
                    prod = await session.get(ProductORM, pid)
                    if not prod:
                        raise ValueError(f"Product {pid} not found")
                    unit_price = float(prod.unit_price)

                new_rows.append(
                    OrderItemORM(
                        order_id=order_orm.id,
                        product_id=pid,
                        quantity=float(data["quantity"]),
                        unit_price=float(unit_price),
                    )
                )

            # Add new items to the session
            for r in new_rows:
                session.add(r)

        # Update the discount (percentage)
        if payload.applied_discount is not None:
            order_orm.applied_discount = payload.applied_discount

        # Recompute the subtotal from the current items
        subtotal_stmt = (
            select(func.coalesce(func.sum(OrderItemORM.quantity * OrderItemORM.unit_price), 0))
            .where(OrderItemORM.order_id == order_orm.id)
        )

        # Compute the subtotal
        subtotal = float(await session.scalar(subtotal_stmt) or 0.0)

        # Apply the current discount
        discount_pct = float(order_orm.applied_discount or 0.0)
        total = subtotal * (1.0 - discount_pct / 100.0)
        total = round(total, 2)

        # Commit the transaction
        await session.commit()
        await session.refresh(order_orm)

    # Return the updated order
    return await get_order_by_id(order_orm.id)


async def delete_order(order_id: int) -> bool:
    """
    Delete an order by its ID.

    Params:
    - order_id (int): The ID of the order to delete.

    Returns:
    - bool: True if the order was deleted, False if not found.
    """

    # Create a new database session
    async with db_session() as session:
        # Check if the order exists
        res = await session.execute(select(OrderORM).where(OrderORM.id == order_id))

        # Get the order if it exists
        order_orm = res.scalar_one_or_none()

        # If the order doesn't exist, return False
        if not order_orm:
            return False

        # Delete the order
        await session.delete(order_orm)

        # Commit the transaction
        await session.commit()

        # Return True to indicate successful deletion
        return True