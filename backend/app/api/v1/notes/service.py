from datetime import date
from typing import Optional, Dict, List
from sqlalchemy import select, asc, desc, func

from ....db.orm import NoteORM
from ....db.session import db_session
from .models import Note, NoteCreate, NoteUpdate
from .constants import ALLOWED_NOTES_SORTING_FIELDS
from ....models import Pagination, ListingQueryParams


async def list_notes(params: ListingQueryParams) -> Pagination[Note]:
    """
    List all notes in the database with pagination, filtering and sorting.

    Parameters:
    - params: ListingQueryParams - includes page, size, filters, and sort options.

    Returns:
    - Pagination[Note]: Paginated list of notes.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    async with db_session() as session:
        # Base statement
        stmt = select(NoteORM)

        # Apply filters (based on ALLOWED_NOTES_SORTING_FIELDS mapping)
        filters: Dict[str, str] = params.filters or {}
        for field, value in filters.items():
            if value is None:
                continue
            if field not in ALLOWED_NOTES_SORTING_FIELDS:
                continue

            col = ALLOWED_NOTES_SORTING_FIELDS[field]

            # Created_at filters (using date boundaries)
            if field == "created_after":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col >= dvalue)

            elif field == "created_before":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col <= dvalue)

            # Updated_at filters (using date boundaries)
            elif field == "updated_after":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col >= dvalue)

            elif field == "updated_before":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col <= dvalue)

            # Generic text filter
            elif field == "text":
                stmt = stmt.where(col.ilike(f"%{value}%"))

            # Fallback (shouldn't occur with current mapping, but safe)
            else:
                stmt = stmt.where(col == value)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Sorting
        if params.sort:
            order_clauses: List = []
            for s in params.sort:
                field = s.field
                order = (s.order or "asc").lower()
                if field in ALLOWED_NOTES_SORTING_FIELDS:
                    col = ALLOWED_NOTES_SORTING_FIELDS[field]
                    order_clauses.append(desc(col) if order == "desc" else asc(col))
            if order_clauses:
                stmt = stmt.order_by(*order_clauses)

        # Pagination
        if size > 0:
            stmt = stmt.offset(offset).limit(size)

        # Execute
        res = await session.execute(stmt)
        rows = res.scalars().all()

        # Build response items
        items = [Note.model_validate(row) for row in rows]

        return Pagination(total=total or 0, items=items)


async def get_note_by_id(note_id: int) -> Optional[Note]:
    """
    Get a note by ID.

    Parameters:
    - note_id: int - ID of the note to retrieve.

    Returns:
    - Optional[Note]: The note if found, else None.
    """

    # Create a new session
    async with db_session() as session:
        # Prepare the query
        stmt = select(NoteORM).where(NoteORM.id == note_id)
        
        # Execute the query
        res = await session.execute(stmt)
        
        # Fetch the single result or None
        obj = res.scalar_one_or_none()
        
        # Convert to Pydantic model if found
        if not obj:
            return None

        # Convert to Pydantic model
        return Note.model_validate(obj)


async def create_note(note_create: NoteCreate) -> Optional[Note]:
    """
    Create a new note.

    Parameters:
    - note_create: NoteCreate - data for the new note.

    Returns:
    - Note: The created note.
    """

    # Create a new session
    async with db_session() as session:
        # Create ORM object
        obj = NoteORM(**note_create.model_dump())
        
        # Add and commit
        session.add(obj)

        # Commit the transaction
        await session.commit()
        await session.refresh(obj)

        # Convert to Pydantic model
        return Note.model_validate(obj)


async def update_note(note_id: int, note_update: NoteUpdate) -> Optional[Note]:
    """
    Update an existing note.

    Parameters:
    - note_id: int - ID of the note to update.
    - note_update: NoteUpdate - fields to update.

    Returns:
    - Optional[Note]: The updated note if found, else None.
    """

    # Create a new session
    async with db_session() as session:
        # Fetch the existing object
        res = await session.execute(select(NoteORM).where(NoteORM.id == note_id))
        
        # Get the object or None
        obj = res.scalar_one_or_none()
        
        # If not found, return None
        if not obj:
            return None

        # Update fields
        data = note_update.model_dump()
        for field, value in data.items():
            if value is not None:
                setattr(obj, field, value)

        # Commit the transaction
        await session.commit()
        await session.refresh(obj)

        # Convert to Pydantic model
        return Note.model_validate(obj)


async def delete_note(note_id: int) -> bool:
    """
    Delete a note by ID.

    Parameters:
    - note_id: int - ID of the note to delete.

    Returns:
    - bool: True if deleted, False if not found.
    """

    # Create a new session
    async with db_session() as session:
        # Fetch the existing object
        res = await session.execute(select(NoteORM).where(NoteORM.id == note_id))
        
        # Get the object or None
        obj = res.scalar_one_or_none()
        
        # If not found, return False
        if not obj:
            return False

        # Delete and commit
        await session.delete(obj)
        await session.commit()

        # Convert to Pydantic model
        return True