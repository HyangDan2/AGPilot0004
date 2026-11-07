from datetime import date

def test_child_crud_and_isolation(client, owner_headers, stranger_headers):
    # 1. Create Child as Owner
    create_payload = {
        "name": "튼튼이",
        "birth_date": "2026-05-15",
        "sex": "male",
        "is_premature": False
    }
    create_res = client.post("/api/babycare/v1/children", json=create_payload, headers=owner_headers)
    assert create_res.status_code == 201
    child_data = create_res.json()
    child_id = child_data["id"]
    assert child_data["name"] == "튼튼이"
    assert child_data["days_since_birth"] >= 0

    # 2. Owner can read child
    get_res = client.get(f"/api/babycare/v1/children/{child_id}", headers=owner_headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "튼튼이"

    # 3. Stranger CANNOT read child (Access Control & Isolation)
    stranger_res = client.get(f"/api/babycare/v1/children/{child_id}", headers=stranger_headers)
    assert stranger_res.status_code == 403

    # 4. Update child as Owner
    update_res = client.patch(
        f"/api/babycare/v1/children/{child_id}",
        json={"name": "튼튼이_개명"},
        headers=owner_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "튼튼이_개명"

    # 5. Stranger CANNOT update child
    stranger_update = client.patch(
        f"/api/babycare/v1/children/{child_id}",
        json={"name": "해킹"},
        headers=stranger_headers
    )
    assert stranger_update.status_code == 403

    # 6. Delete child as Owner
    del_res = client.delete(f"/api/babycare/v1/children/{child_id}", headers=owner_headers)
    assert del_res.status_code == 204

    # 7. Check deleted
    assert client.get(f"/api/babycare/v1/children/{child_id}", headers=owner_headers).status_code == 404
