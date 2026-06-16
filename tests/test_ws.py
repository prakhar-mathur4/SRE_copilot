"""WebSocket handshake authentication (/api/v1/ws/alerts)."""
import pytest


def test_ws_rejects_unauthenticated(client):
    # No session cookie → handshake rejected before accept (close 1008).
    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/ws/alerts"):
            pass


def test_ws_allows_authenticated(login):
    c, _, _ = login("view1", "Password123")
    # Authenticated session cookie is sent on the handshake → connection accepted.
    with c.websocket_connect("/api/v1/ws/alerts") as ws:
        ws.send_text("ping")  # server just logs client messages; no error = accepted
