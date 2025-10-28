from datetime import date
from typing import Optional, Dict, List, Set
from sqlalchemy import select, asc, desc, func, update

from ....db.session import db_session
from ....db.orm.lot import LotORM
from ....db.orm.order import OrderORM
from ....db.orm.order_item import OrderItemORM
from ....db.orm.product import ProductORM
from ....db.orm.customer import CustomerORM
from ....models import Pagination, ListingQueryParams
from .constants import ALLOWED_LOTS_SORTING_FIELDS
from .models import Lot, LotCreate, LotUpdate, LotOrderItem


def _compose_lot_name(lot_date: date, location: str) -> str:
    clean_location = (location or "").strip()
    base = lot_date.strftime("%Y%m%d")
    return f"{base} {clean_location}".strip()


async def list_lots(params: ListingQueryParams) -> Pagination[Lot]:
    """
    List lots with pagination, filtering and sorting.

    Parameters:
    - params (ListingQueryParams): Query params including pagination, filters, sort.

    Returns:
    - Pagination[Lot]: Paginated lots with related order items.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    async with db_session() as session:
        # Base statement
        stmt = select(LotORM)

        # Apply filters
        filters: Dict[str, str] = params.filters or {}
        for field, value in filters.items():
            if value is None:
                continue
            if field not in ALLOWED_LOTS_SORTING_FIELDS:
                continue

            col = ALLOWED_LOTS_SORTING_FIELDS[field]

            if field == "id":
                try:
                    stmt = stmt.where(col == int(value))
                except (TypeError, ValueError):
                    stmt = stmt.where(col == -1)

            elif field == "lot_date_after":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col >= dvalue)

            elif field == "lot_date_before":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col <= dvalue)

            else:
                stmt = stmt.where(col.ilike(f"%{value}%"))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Sorting
        if params.sort:
            order_clauses: List = []
            for s in params.sort:
                field = s.field
                order = (s.order or "asc").lower()
                if field in ALLOWED_LOTS_SORTING_FIELDS:
                    col = ALLOWED_LOTS_SORTING_FIELDS[field]
                    order_clauses.append(desc(col) if order == "desc" else asc(col))
            if order_clauses:
                stmt = stmt.order_by(*order_clauses)

        # Pagination
        if size >= 0:
            stmt = stmt.offset(offset).limit(size)

        # Execute query
        result = await session.execute(stmt)
        lots_orm = result.scalars().all()

        if not lots_orm:
            return Pagination(total=total, items=[])

        # Collect lot IDs
        lot_ids = [lot.id for lot in lots_orm]

        # Fetch related order items
        items_stmt = (
            select(
                OrderItemORM,
                OrderORM.delivery_date.label("order_date"),
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("product_unit"),
                CustomerORM.id.label("customer_id"),
                CustomerORM.name.label("customer_name"),
            )
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .join(OrderORM, OrderORM.id == OrderItemORM.order_id)
            .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
            .where(OrderItemORM.lot_id.in_(lot_ids))
        )
        items_res = await session.execute(items_stmt)

        items_by_lot: Dict[int, List[LotOrderItem]] = {}
        for item, order_date, product_name, product_unit, customer_id, customer_name in items_res.all():
            items_by_lot.setdefault(item.lot_id, []).append(
                LotOrderItem.model_validate(
                    {
                        "id": item.id,
                        "order_id": item.order_id,
                        "order_date": order_date,
                        "product_id": item.product_id,
                        "quantity": float(item.quantity),
                        "unit_price": float(item.unit_price),
                        "product_name": product_name,
                        "product_unit": product_unit,
                        "customer_id": customer_id,
                        "customer_name": customer_name,
                    }
                )
            )

        # Build response models
        lot_models: List[Lot] = []
        for lot in lots_orm:
            lot_model = Lot.model_validate(lot)
            lot_model.order_items = items_by_lot.get(lot.id, [])
            lot_models.append(lot_model)

        return Pagination(total=total, items=lot_models)


async def get_lot_by_id(lot_id: int) -> Optional[Lot]:
    """
    Retrieve a single lot by ID with its order items.

    Parameters:
    - lot_id (int): ID of the lot to retrieve.

    Returns:
    - Optional[Lot]: Lot model if found, else None.
    """

    async with db_session() as session:
        res = await session.execute(select(LotORM).where(LotORM.id == lot_id))
        lot = res.scalar_one_or_none()

        if not lot:
            return None

        items_stmt = (
            select(
                OrderItemORM,
                OrderORM.delivery_date.label("order_date"),
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("product_unit"),
                CustomerORM.id.label("customer_id"),
                CustomerORM.name.label("customer_name"),
            )
            .join(ProductORM, ProductORM.id == OrderItemORM.product_id)
            .join(OrderORM, OrderORM.id == OrderItemORM.order_id)
            .join(CustomerORM, CustomerORM.id == OrderORM.customer_id)
            .where(OrderItemORM.lot_id == lot.id)
        )
        items_res = await session.execute(items_stmt)
        order_items = [
            LotOrderItem.model_validate(
                {
                    "id": item.id,
                    "order_id": item.order_id,
                    "order_date": order_date,
                    "product_id": item.product_id,
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "product_name": product_name,
                    "product_unit": product_unit,
                    "customer_id": customer_id,
                    "customer_name": customer_name,
                }
            )
            for item, order_date, product_name, product_unit, customer_id, customer_name in items_res.all()
        ]

        lot_model = Lot.model_validate(lot)
        lot_model.order_items = order_items
        return lot_model


async def create_lot(payload: LotCreate) -> Optional[Lot]:
    """
    Create a new lot and optionally associate order items.

    Parameters:
    - payload (LotCreate): Lot data and optional associations.

    Returns:
    - Optional[Lot]: Created lot if successful.
    """

    async with db_session() as session:
        clean_location = payload.location.strip()
        expected_name = _compose_lot_name(payload.lot_date, clean_location)
        provided_name = payload.name.strip()
        final_name = expected_name if provided_name != expected_name else provided_name

        lot = LotORM(
            lot_date = payload.lot_date,
            name = final_name,
            location = clean_location,
            description = payload.description,
        )

        session.add(lot)
        await session.flush()

        # Associate items if requested
        await _apply_lot_associations(
            session = session,
            lot_id = lot.id,
            order_id = payload.order_id,
            order_item_ids = payload.order_item_ids,
        )

        await session.commit()
        await session.refresh(lot)

    return await get_lot_by_id(lot.id)


async def update_lot(lot_id: int, payload: LotUpdate) -> Optional[Lot]:
    """
    Update lot metadata and optionally its associated order items.

    Parameters:
    - lot_id (int): ID of the lot to update.
    - payload (LotUpdate): Fields to update.

    Returns:
    - Optional[Lot]: Updated lot if found.
    """

    async with db_session() as session:
        res = await session.execute(select(LotORM).where(LotORM.id == lot_id))
        lot = res.scalar_one_or_none()

        if not lot:
            return None

        if payload.lot_date is not None:
            lot.lot_date = payload.lot_date
        if payload.name is not None:
            lot.name = payload.name.strip()
        if payload.location is not None:
            lot.location = payload.location.strip()
        if payload.description is not None:
            lot.description = payload.description

        expected_name = _compose_lot_name(lot.lot_date, lot.location)
        if payload.name is None or lot.name != expected_name:
            lot.name = expected_name

        if payload.order_item_ids is not None or payload.order_id is not None:
            await _apply_lot_associations(
                session = session,
                lot_id = lot.id,
                order_id = payload.order_id,
                order_item_ids = payload.order_item_ids,
            )

        await session.commit()
        await session.refresh(lot)

    return await get_lot_by_id(lot.id)


async def delete_lot(lot_id: int) -> bool:
    """
    Delete a lot and detach associated order items.

    Parameters:
    - lot_id (int): ID of the lot to delete.

    Returns:
    - bool: True if deleted, False otherwise.
    """

    async with db_session() as session:
        res = await session.execute(select(LotORM).where(LotORM.id == lot_id))
        lot = res.scalar_one_or_none()

        if not lot:
            return False

        # Detach order items
        await session.execute(
            update(OrderItemORM)
            .where(OrderItemORM.lot_id == lot.id)
            .values(lot_id=None)
        )

        await session.delete(lot)
        await session.commit()

    return True


async def _apply_lot_associations(
    session,
    lot_id: int,
    order_id: Optional[int],
    order_item_ids: Optional[List[int]],
) -> None:
    """
    Apply lot associations to order items (attach/detach).

    Parameters:
    - session: Active AsyncSession.
    - lot_id (int): Lot identifier.
    - order_id (Optional[int]): Optional order to scope order items.
    - order_item_ids (Optional[List[int]]): Explicit order item IDs.
    """

    # Ensure order exists if provided
    if order_id is not None:
        if not await session.get(OrderORM, order_id):
            raise ValueError(f"Ordine {order_id} non trovato")

    # Determine target items
    target_item_ids: Set[int] = set()
    explicit_ids: Optional[Set[int]] = (
        set(order_item_ids or []) if order_item_ids is not None else None
    )

    if explicit_ids is not None:
        if explicit_ids:
            items_stmt = select(OrderItemORM.id, OrderItemORM.order_id).where(OrderItemORM.id.in_(explicit_ids))
            if order_id is not None:
                items_stmt = items_stmt.where(OrderItemORM.order_id == order_id)
            items_res = await session.execute(items_stmt)
            rows = items_res.all()
            found_ids = {row.id for row in rows}

            missing = explicit_ids - found_ids
            if missing:
                missing_str = ", ".join(str(mid) for mid in sorted(missing))
                raise ValueError(f"Item ordini non trovati: {missing_str}")

            target_item_ids = found_ids
        else:
            target_item_ids = set()
    elif order_id is not None:
        items_res = await session.execute(
            select(OrderItemORM.id).where(OrderItemORM.order_id == order_id)
        )
        target_item_ids = {row.id for row in items_res.all()}

    # If no association change requested, exit
    if explicit_ids is None and order_id is None:
        return

    # Detach previous associations for this lot
    await session.execute(
        update(OrderItemORM)
        .where(OrderItemORM.lot_id == lot_id)
        .values(lot_id=None)
    )

    if not target_item_ids:
        return

    # Attach new associations
    await session.execute(
        update(OrderItemORM)
        .where(OrderItemORM.id.in_(target_item_ids))
        .values(lot_id=lot_id)
    )
