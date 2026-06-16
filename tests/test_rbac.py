"""Role-based access control across the dashboard surface."""


def test_viewer_can_read_incidents(login):
    c, _, _ = login("view1", "Password123")
    assert c.get("/api/v1/incidents").status_code == 200


def test_viewer_cannot_read_settings(login):
    c, _, _ = login("view1", "Password123")
    r = c.get("/api/v1/settings")
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"


def test_responder_inherits_viewer_reads(login):
    c, _, _ = login("resp1", "Password123")
    assert c.get("/api/v1/incidents").status_code == 200


def test_responder_cannot_delete_pod(login):
    c, csrf, _ = login("resp1", "Password123")
    # privileged/admin op — middleware blocks before the route runs (no k8s call)
    r = c.delete("/api/v1/pods/default/whatever", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"


def test_viewer_cannot_add_filter(login):
    c, csrf, _ = login("view1", "Password123")
    r = c.post("/api/v1/filters", headers={"X-CSRF-Token": csrf},
               json={"name": "n", "expression": "true", "action": "discard"})
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"


def test_maintainer_can_add_filter(login):
    c, csrf, _ = login("maint1", "Password123")
    r = c.post("/api/v1/filters", headers={"X-CSRF-Token": csrf},
               json={"name": "n", "expression": "true", "action": "discard"})
    assert r.status_code == 200


def test_maintainer_cannot_read_settings(login):
    c, _, _ = login("maint1", "Password123")
    assert c.get("/api/v1/settings").status_code == 403


def test_admin_reads_masked_settings(login):
    c, _, _ = login("admin1", "Password123")
    r = c.get("/api/v1/settings")
    assert r.status_code == 200
    body = r.json()
    assert "secrets" in body
    # raw secret values are never echoed in the env block
    assert "OPENAI_API_KEY" not in body.get("env", {})


def test_webhook_is_exempt_from_session_auth(client):
    # Machine path: an invalid body reaches the route (422) rather than being
    # blocked by the session gate (401) — proves the webhook bypasses session auth.
    r = client.post("/api/v1/alerts/webhook", json={})
    assert r.status_code == 422
