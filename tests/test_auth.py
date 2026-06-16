"""Authentication: login, lockout, sessions, forced change, CSRF."""


def test_unauthenticated_request_is_rejected(client):
    r = client.get("/api/v1/incidents")
    assert r.status_code == 401
    assert r.json()["code"] == "unauthenticated"


def test_login_success(login):
    c, csrf, r = login("view1", "Password123")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "view1"
    assert body["role"] == "viewer"
    assert body["must_change_password"] is False
    assert csrf


def test_login_wrong_password(login):
    _, _, r = login("view1", "wrong-password")
    assert r.status_code == 401
    assert r.json()["code"] == "invalid_credentials"


def test_login_unknown_user(login):
    _, _, r = login("ghost", "whatever-123")
    assert r.status_code == 401


def test_lockout_after_repeated_failures(client):
    # MAX_FAILED_LOGINS = 3 in the test env
    for _ in range(2):
        r = client.post("/api/v1/auth/login", json={"username": "resp1", "password": "bad"})
        assert r.status_code == 401
    r = client.post("/api/v1/auth/login", json={"username": "resp1", "password": "bad"})
    assert r.status_code == 429  # now locked
    # even the correct password is refused while locked
    r = client.post("/api/v1/auth/login", json={"username": "resp1", "password": "Password123"})
    assert r.status_code == 429


def test_me_returns_current_user(login):
    c, _, _ = login("admin1", "Password123")
    r = c.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "admin1"
    assert r.json()["role"] == "admin"


def test_logout_revokes_session(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert c.get("/api/v1/incidents").status_code == 401


def test_forced_password_change_flow(login):
    c, csrf, r = login("fresh1", "Temp123456")
    assert r.status_code == 200
    assert r.json()["must_change_password"] is True

    # blocked from everything until the password is changed
    blocked = c.get("/api/v1/incidents")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"

    # weak password is rejected
    weak = c.post("/api/v1/auth/change-password",
                  headers={"X-CSRF-Token": csrf}, json={"new_password": "short"})
    assert weak.status_code == 400

    # valid change clears the flag
    ok = c.post("/api/v1/auth/change-password",
                headers={"X-CSRF-Token": csrf}, json={"new_password": "NewStrongPass1"})
    assert ok.status_code == 200
    assert ok.json()["must_change_password"] is False

    # access is now granted (cookie was refreshed by the change)
    assert c.get("/api/v1/incidents").status_code == 200


def test_csrf_required_on_mutations(login):
    c, _, _ = login("maint1", "Password123")
    # no X-CSRF-Token header on a mutating request
    r = c.post("/api/v1/filters", json={"name": "x", "expression": "true", "action": "discard"})
    assert r.status_code == 403
    assert r.json()["code"] == "csrf_failed"
