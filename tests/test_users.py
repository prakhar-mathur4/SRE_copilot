"""Admin user-management endpoints (/api/v1/users)."""


def _user_id(client, username):
    users = client.get("/api/v1/users").json()["users"]
    return next(u["id"] for u in users if u["username"] == username)


def test_non_admin_cannot_list_users(login):
    c, _, _ = login("resp1", "Password123")
    assert c.get("/api/v1/users").status_code == 403


def test_admin_can_list_users(login):
    c, _, _ = login("admin1", "Password123")
    r = c.get("/api/v1/users")
    assert r.status_code == 200
    assert "owner1" in [u["username"] for u in r.json()["users"]]


def test_admin_creates_user_with_temp_password(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.post("/api/v1/users", headers={"X-CSRF-Token": csrf},
               json={"username": "newbie", "role": "responder"})
    assert r.status_code == 200
    temp = r.json()["temp_password"]
    assert temp

    # new user can log in and is forced to change their password
    c2 = c
    _, _, login_resp = login("newbie", temp)
    assert login_resp.status_code == 200
    assert login_resp.json()["must_change_password"] is True


def test_duplicate_username_rejected(login):
    c, csrf, _ = login("admin1", "Password123")
    r = c.post("/api/v1/users", headers={"X-CSRF-Token": csrf},
               json={"username": "view1", "role": "viewer"})
    assert r.status_code == 400


def test_admin_changes_role(login):
    c, csrf, _ = login("admin1", "Password123")
    uid = _user_id(c, "resp1")
    r = c.patch(f"/api/v1/users/{uid}", headers={"X-CSRF-Token": csrf}, json={"role": "maintainer"})
    assert r.status_code == 200
    assert r.json()["role"] == "maintainer"


def test_reset_password_invalidates_old(login):
    c, csrf, _ = login("admin1", "Password123")
    uid = _user_id(c, "view1")
    r = c.post(f"/api/v1/users/{uid}/reset-password", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
    assert r.json()["temp_password"]
    # old password no longer works
    _, _, old = login("view1", "Password123")
    assert old.status_code == 401


def test_owner_cannot_be_deleted(login):
    c, csrf, _ = login("admin1", "Password123")
    uid = _user_id(c, "owner1")
    r = c.delete(f"/api/v1/users/{uid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 400


def test_admin_cannot_delete_self(login):
    c, csrf, _ = login("admin1", "Password123")
    uid = _user_id(c, "admin1")
    r = c.delete(f"/api/v1/users/{uid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 400


def test_admin_deletes_user(login):
    c, csrf, _ = login("admin1", "Password123")
    uid = _user_id(c, "view1")
    r = c.delete(f"/api/v1/users/{uid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200
