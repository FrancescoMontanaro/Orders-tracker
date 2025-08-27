from pydantic import BaseModel
from typing import TypeVar, Type, Dict
from sqlalchemy import select, func, asc, desc
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Pagination, ListingQueryParams


T = TypeVar("T")  # ORM model type
M = TypeVar("M", bound=BaseModel)  # Pydantic model type


async def paginate_filter_sort(
    session: AsyncSession,
    model: Type[T],
    pydantic_model: Type[M],
    allowed_fields: Dict[str, InstrumentedAttribute],
    params: ListingQueryParams
) -> Pagination[M]:
    """
    Generic helper to apply pagination, filtering, and sorting to a SQLAlchemy query.

    Args:
    - session: SQLAlchemy AsyncSession
    - model: ORM model to query
    - pydantic_model: Pydantic model for output mapping
    - allowed_fields: dict of allowed field names -> ORM column
    - params: ListingQueryParams object

    Returns:
    - dict: {"total": int, "items": List[pydantic_model]}
    """
    
    # Get pagination parameters
    page = max(1, params.page)
    size = max(1, params.size)
    offset = (page - 1) * size

    # Initialize query
    stmt = select(model)

    # Apply filters
    if params.filters:
        # Iterate over filter fields
        for field, value in params.filters.items():
            # Skip invalid fields
            if field in allowed_fields and value is not None:
                # Apply filter
                if isinstance(value, str):
                    # Use ilike for string fields
                    stmt = stmt.where(allowed_fields[field].ilike(f"%{value}%"))
                elif isinstance(value, (int, float, bool)):
                    # Use equality for numeric and boolean fields
                    stmt = stmt.where(allowed_fields[field] == value)

    # Count total (with filters)
    count_stmt = select(func.count()).select_from(stmt.subquery())

    # Sorting
    if params.sort:
        # Build order clauses based on allowed fields
        order_clauses = []

        # Iterate over sort fields
        for s in params.sort:
            # Extract field and order
            field = s.field
            order = s.order

            # Skip invalid fields
            if field in allowed_fields:
                # Get the column
                col = allowed_fields[field]

                # Apply sorting
                if order == "desc":
                    order_clauses.append(desc(col))
                else:
                    order_clauses.append(asc(col))

        # If there are order clauses, apply sorting
        if order_clauses:
            # Apply sorting
            stmt = stmt.order_by(*order_clauses)

    # Apply pagination
    stmt = stmt.offset(offset).limit(size)

    # Count total (with filters)
    total = await session.scalar(count_stmt)
    result = await session.execute(stmt)
    rows = result.scalars().all()

    # Return paginated response
    return Pagination(
        total = total or 0,
        items = [pydantic_model.model_validate(row, from_attributes=True) for row in rows]
    )