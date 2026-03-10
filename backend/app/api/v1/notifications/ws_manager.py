from fastapi import WebSocket
from collections import defaultdict


class ConnectionManager:
    """
    In-process WebSocket connection manager.

    Maintains a map of user_id → set of active WebSocket connections.
    Multiple connections per user are supported (e.g. multiple browser tabs).
    """

    def __init__(self) -> None:
        # Maps each user_id to the set of its active WebSocket connections
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection for the given user."""

        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """Remove a WebSocket connection. Cleans up the user entry if no connections remain."""

        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            del self._connections[user_id]

    async def broadcast(self, user_id: int, payload: dict) -> None:
        """
        Send a JSON payload to all active connections of the given user.
        Silently removes connections that have already been closed.

        Parameters:
        - user_id (int): The target user.
        - payload (dict): The JSON-serialisable message to send.
        """

        dead: list[WebSocket] = []

        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                # Connection is gone; schedule for cleanup
                dead.append(ws)

        for ws in dead:
            self.disconnect(user_id, ws)


# Module-level singleton shared by the whole application process
manager = ConnectionManager()
