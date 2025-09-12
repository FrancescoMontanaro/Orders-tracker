from datetime import date
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException, Query

from ....core.response_models import SuccessResponse
from .models import Note, NoteCreate, NoteUpdate
from ....models import Pagination, SortParam, ListingQueryParams

# Services
from .service import (
    list_notes as list_notes_service,
    get_note_by_id as get_note_by_id_service,
    create_note as create_note_service,
    update_note as update_note_service,
    delete_note as delete_note_service,
)

# Create the router
router = APIRouter(prefix="/notes", tags=["Notes"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Note]]
)
async def list_notes(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    created_after: Optional[date] = Query(default=None, description="Optional filter for notes created after this date"),
    created_before: Optional[date] = Query(default=None, description="Optional filter for notes created before this date"),
    updated_after: Optional[date] = Query(default=None, description="Optional filter for notes updated after this date"),
    updated_before: Optional[date] = Query(default=None, description="Optional filter for notes updated before this date"),
    text: Optional[str] = Query(default=None, description="Optional text search (ILIKE)"),
) -> SuccessResponse[Pagination[Note]]:
    """
    List notes with pagination, filtering and sorting.

    Params:
    - page: The page number.
    - size: The page size.
    - filters: The filters to apply.
    - sort: The sorting options.
    - created_after: Optional filter for notes created after this date.
    - created_before: Optional filter for notes created before this date.
    - updated_after: Optional filter for notes updated after this date.
    - updated_before: Optional filter for notes updated before this date.
    - text: Optional text search (ILIKE).

    Returns:
    - A paginated list of notes.
    """

    # Merge convenience query params into filters
    if created_after:
        filters = (filters or {}) | {"created_after": created_after.isoformat()}
    if created_before:
        filters = (filters or {}) | {"created_before": created_before.isoformat()}
    if updated_after:
        filters = (filters or {}) | {"updated_after": updated_after.isoformat()}
    if updated_before:
        filters = (filters or {}) | {"updated_before": updated_before.isoformat()}
    if text:
        filters = (filters or {}) | {"text": text}

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service
    data = await list_notes_service(params)

    # Return the response
    return SuccessResponse(data=data)


@router.get(
    path = "/{note_id}",
    response_model = SuccessResponse[Note]
)
async def get_note_by_id(note_id: int) -> SuccessResponse[Note]:
    """
    Get a note by ID.

    Params:
    - note_id: The ID of the note.

    Returns:
    - The note with the given ID.
    """

    # Call the service
    note = await get_note_by_id_service(note_id)
    
    # If not found, raise 404
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota non trovata")
    
    # Return the response
    return SuccessResponse(data=note)


@router.post(
    path = "/",
    response_model = SuccessResponse[Note],
    status_code=status.HTTP_201_CREATED
)
async def create_note(note_create: NoteCreate) -> SuccessResponse[Note]:
    """
    Create a new note.

    Params:
    - note_create: The note data to create.

    Returns:
    - The created note.
    """

    # Call the service
    created = await create_note_service(note_create)
    
    # If creation failed, raise 500
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione della nota")
    
    # Return the response
    return SuccessResponse(data=created)


@router.patch(
    path = "/{note_id}",
    response_model = SuccessResponse[Note],
)
async def update_note(note_id: int, note_update: NoteUpdate) -> SuccessResponse[Note]:
    """
    Update an existing note.

    Params:
    - note_id: The ID of the note to update.
    - note_update: The updated note data.

    Returns:
    - The updated note.
    """

    # Call the service
    updated = await update_note_service(note_id, note_update)
    
    # If not found, raise 404
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota non trovata")
    
    # Return the response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/{note_id}",
    response_model = SuccessResponse[None]
)
async def delete_note(note_id: int) -> SuccessResponse[None]:
    """
    Delete a note by ID.

    Params:
    - note_id: The ID of the note to delete.
    """

    # Call the service
    deleted = await delete_note_service(note_id)
    
    # If not found, raise 404
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota non trovata")
    
    # Return the response
    return SuccessResponse(data=None)