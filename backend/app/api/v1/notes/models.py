from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class Note(BaseModel):
    """
    Represents a note in the system.
    """

    id: int
    created_at: datetime
    updated_at: datetime
    text: str

    class Config:
        from_attributes = True


class NoteCreate(BaseModel):
    """
    Represents a request to create a new note.
    """

    text: str = Field(min_length=1, description="The note content")


class NoteUpdate(BaseModel):
    """
    Represents a request to update an existing note.
    """

    text: Optional[str] = Field(default=None, min_length=1, description="The updated note content")