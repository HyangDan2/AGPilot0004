def test_dev_login(client):
    res = client.post("/api/babycare/v1/auth/dev-login", json={
        "email": "test@hd2lab.org",
        "name": "테스터",
        "role": "user"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@hd2lab.org"

def test_get_me_unauthorized(client):
    res = client.get("/api/babycare/v1/auth/me")
    assert res.status_code == 401

def test_get_me_authorized(client, owner_headers, owner_user):
    res = client.get("/api/babycare/v1/auth/me", headers=owner_headers)
    assert res.status_code == 200
    assert res.json()["email"] == owner_user.email
