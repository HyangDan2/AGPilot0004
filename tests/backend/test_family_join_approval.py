def test_six_digit_invite_and_two_step_owner_approval(client, owner_headers, stranger_headers):
    caregiver_headers = stranger_headers
    # 1. Owner registers a baby
    create_res = client.post(
        "/api/babycare/v1/children",
        json={"name": "태휘", "birth_date": "2026-06-09", "sex": "male"},
        headers=owner_headers,
    )
    assert create_res.status_code == 201
    child_id = create_res.json()["id"]

    # 2. Owner generates 6-digit invite code
    code_res = client.post(
        f"/api/babycare/v1/children/{child_id}/invite-code",
        json={"role": "caregiver"},
        headers=owner_headers,
    )
    assert code_res.status_code == 200
    code = code_res.json()["code"]
    assert len(code) == 6 and code.isdigit()

    # 3. Crew submits 6-digit code -> enters 'pending' state
    join_res = client.post(
        "/api/babycare/v1/children/join-request",
        json={"code": code},
        headers=caregiver_headers,
    )
    assert join_res.status_code == 200
    assert join_res.json()["status"] == "pending"

    # 4. Security check: Before Owner re-confirms/approves, Crew CANNOT access the child!
    assert client.get(f"/api/babycare/v1/children/{child_id}", headers=caregiver_headers).status_code == 403
    crew_children = client.get("/api/babycare/v1/children", headers=caregiver_headers).json()
    assert all(c["id"] != child_id for c in crew_children)

    # 5. Owner lists pending requests and approves Crew
    pending_res = client.get(f"/api/babycare/v1/children/{child_id}/members/pending", headers=owner_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    assert len(pending_list) == 1
    member_id = pending_list[0]["id"]

    approve_res = client.post(
        f"/api/babycare/v1/children/{child_id}/members/{member_id}/approve",
        json={"role": "caregiver"},
        headers=owner_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["role"] == "caregiver"

    # 6. Now Crew can view the shared child!
    shared_res = client.get(f"/api/babycare/v1/children/{child_id}", headers=caregiver_headers)
    assert shared_res.status_code == 200
    assert shared_res.json()["name"] == "태휘"
    assert shared_res.json()["role"] == "caregiver"


def test_google_oauth_status_endpoint(client):
    res = client.get("/api/babycare/v1/auth/google/status")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert data["login_url"] == "/api/babycare/v1/auth/google/login"
