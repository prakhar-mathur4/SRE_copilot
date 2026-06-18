"""Step-up re-authentication for destructive operations."""


def test_destructive_pod_delete_requires_step_up(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.delete("/api/v1/pods/default/whatever", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 403
    assert r.json()["code"] == "step_up_required"


def test_settings_env_requires_step_up(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.post("/api/v1/settings/env", headers={"X-CSRF-Token": csrf}, json={})
    assert r.status_code == 403
    assert r.json()["code"] == "step_up_required"


def test_step_up_wrong_password(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.post("/api/v1/auth/step-up", headers={"X-CSRF-Token": csrf}, json={"password": "nope"})
    assert r.status_code == 400
    assert r.json()["code"] == "invalid_password"


def test_step_up_requires_csrf(login):
    c, _, _ = login("admin1", "Password123")
    r = c.post("/api/v1/auth/step-up", json={"password": "Password123"})
    assert r.status_code == 403
    assert r.json()["code"] == "csrf_failed"


def test_step_up_then_destructive_passes_the_gate(login):
    c, csrf, _ = login("admin1", "Password123")
    up = c.post("/api/v1/auth/step-up", headers={"X-CSRF-Token": csrf}, json={"password": "Password123"})
    assert up.status_code == 200
    # The step-up gate now passes; the route executes (and fails 500 because no
    # k8s is wired in tests) — the point is it is no longer blocked by step-up.
    r = c.delete("/api/v1/pods/default/whatever", headers={"X-CSRF-Token": csrf})
    assert r.status_code != 403


def test_step_up_does_not_help_a_lower_role(login):
    # A responder is blocked by role before step-up is ever considered.
    c, csrf, _ = login("resp1", "Password123")
    c.post("/api/v1/auth/step-up", headers={"X-CSRF-Token": csrf}, json={"password": "Password123"})
    r = c.delete("/api/v1/pods/default/whatever", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"
