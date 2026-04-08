from fastapi import WebSocket
from collections import defaultdict


class WSConnectionManager:
    """
    In-process WebSocket connection manager.

    Maintains a map of user_id → set of active WebSocket connections.
    Multiple connections per user are supported (e.g. multiple browser tabs).
    """

    def __init__(self) -> None:
        """
        Initializes the connection manager with an empty mapping of user connections.
        """

        # Maps each user_id to the set of its active WebSocket connections
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)


    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        """
        Accept and register a new WebSocket connection for the given user.
        
        Parameters:
        - user_id (int): The ID of the user establishing the connection.
        - websocket (WebSocket): The WebSocket connection to register.
        """

        # Accept the WebSocket connection
        await websocket.accept()

        # Register the connection under the user's ID
        self._connections[user_id].add(websocket)


    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        """
        Remove a WebSocket connection. Cleans up the user entry if no connections remain.
        
        Parameters:
        - user_id (int): The ID of the user whose connection is being removed.
        - websocket (WebSocket): The WebSocket connection to remove.
        """

        # Remove the connection from the user's set. If the set becomes empty, remove the user entry.
        self._connections[user_id].discard(websocket)

        # If the user has no more active connections, remove the user from the mapping
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

        # List of connections that failed to receive the message (e.g. because they were closed)
        dead: list[WebSocket] = []

        # Send the payload to all active connections of the user. If sending fails, mark the connection as dead for cleanup.
        for ws in list(self._connections.get(user_id, set())):
            try:
                # Send the JSON payload to the WebSocket connection
                await ws.send_json(payload)

            except Exception:
                # Connection is gone; schedule for cleanup
                dead.append(ws)

        # Clean up dead connections
        for ws in dead:
            self.disconnect(user_id, ws)


# Module-level singletons, one per WebSocket channel.
notifications_ws_manager = WSConnectionManager()
export_ws_manager = WSConnectionManager()