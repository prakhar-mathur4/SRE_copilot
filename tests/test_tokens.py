"""API tokens / service accounts (/api/v1/tokens) and Bearer authentication."""
from tests.conftest import _iso_now
from bot.auth import passwords, store


def _create_token(admin_client, csrf, name="ci", role="viewer", expires_in_days=None):
    r = admin_client.post("/api/v1/tokens", headers={"X-CSRF-Token": csrf},
                          json={"name": name, "role": role, "expires_in_days": expires_in_days})
    return r


def test_non_admin_cannot_manage_tokens(login):
    c, csrf, _ = login("maint1", "Password123")
    assert c.get("/api/v1/tokens").status_code == 403
    assert _create_token(c, csrf).status_code == 403


def test_admin_creates_token_shown_once(login):
    c, csrf, _ = login("admin1", "Password123")
    r = _create_token(c, csrf, name="ci-pipeline", role="responder")
    assert r.status_code == 200
    body = r.json()
    assert body["token"].startswith("sk_")
    assert body["role"] == "responder"
    # listing never returns the raw token / hash
    listed = c.get("/api/v1/tokens").json()["tokens"]
    assert any(t["name"] == "ci-pipeline" for t in listed)
    assert all("token" not in t and "token_hash" not in t for t in listed)


def test_bearer_token_grants_role_access(login, client):
    c, csrf, _ = login("admin1", "Password123")
    token = _create_token(c, csrf, role="viewer").json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    # viewer-tier read works
    assert client.get("/api/v1/incidents", headers=h).status_code == 200
    # admin-only read is forbidden for a viewer token
    r = client.get("/api/v1/settings", headers=h)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"


def test_bearer_token_is_csrf_exempt(login, client):
    c, csrf, _ = login("admin1", "Password123")
    token = _create_token(c, csrf, role="maintainer").json()["token"]
    # No X-CSRF-Token header — bearer auth is immune to CSRF
    r = client.post("/api/v1/filters", headers={"Authorization": f"Bearer {token}"},
                    json={"name": "n", "expression": "true", "action": "discard"})
    assert r.status_code == 200


def test_bearer_token_cannot_do_step_up_ops(login, client):
    c, csrf, _ = login("admin1", "Password123")
    token = _create_token(c, csrf, role="admin").json()["token"]
    # Even an admin-role token cannot perform human-only destructive ops
    r = client.delete("/api/v1/pods/default/x", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403 and r.json()["code"] == "token_forbidden"


def test_invalid_bearer_token_rejected(client):
    r = client.get("/api/v1/incidents", headers={"Authorization": "Bearer sk_not-a-real-token"})
    assert r.status_code == 401 and r.json()["code"] == "invalid_token"


def test_revoked_token_rejected(login, client):
    c, csrf, _ = login("admin1", "Password123")
    created = _create_token(c, csrf, role="viewer").json()
    token, tid = created["token"], created["id"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/incidents", headers=h).status_code == 200
    # revoke it
    assert c.delete(f"/api/v1/tokens/{tid}", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert client.get("/api/v1/incidents", headers=h).status_code == 401


def test_expired_token_rejected(client):
    # Seed an already-expired token directly, then try to use it.
    raw = passwords.new_api_token()
    store.create_api_token("expired", passwords.hash_token(raw), "viewer", "admin1",
                           _iso_now(), "2000-01-01T00:00:00+00:00")
    r = client.get("/api/v1/incidents", headers={"Authorization": f"Bearer {raw}"})
    assert r.status_code == 401
