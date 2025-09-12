from ....db.orm.note import NoteORM

# Define allowed fields for filtering and sorting
ALLOWED_NOTES_SORTING_FIELDS = {
    # direct columns
    "id": NoteORM.id,
    "created_at": NoteORM.created_at,
    "updated_at": NoteORM.updated_at,
    "text": NoteORM.text,

    # semantic filter aliases (mapped to columns)
    "created_after": NoteORM.created_at,
    "created_before": NoteORM.created_at,
    "updated_after": NoteORM.updated_at,
    "updated_before": NoteORM.updated_at,
}