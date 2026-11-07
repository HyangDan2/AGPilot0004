def test_feeding_workflow(client, owner_headers):
    child_res = client.post("/api/babycare/v1/children", json={
        "name": "수유아",
        "birth_date": "2026-03-01",
        "sex": "male"
    }, headers=owner_headers)
    child_id = child_res.json()["id"]

    # 1. Formula feeding record
    feed1 = client.post(f"/api/babycare/v1/children/{child_id}/feeding", json={
        "feeding_type": "formula",
        "start_time": "2026-03-05T08:00:00",
        "amount_ml": 140,
        "notes": "아침 첫 수유"
    }, headers=owner_headers)
    assert feed1.status_code == 201

    # 2. Breastfeeding record
    feed2 = client.post(f"/api/babycare/v1/children/{child_id}/feeding", json={
        "feeding_type": "breastfeeding",
        "start_time": "2026-03-05T12:00:00",
        "left_duration_min": 15,
        "right_duration_min": 15
    }, headers=owner_headers)
    assert feed2.status_code == 201

    # 3. Check daily summary
    summary_res = client.get(
        f"/api/babycare/v1/children/{child_id}/feeding/daily-summary?date_str=2026-03-05",
        headers=owner_headers
    )
    assert summary_res.status_code == 200
    sdata = summary_res.json()
    assert sdata["total_amount_ml"] == 140.0
    assert sdata["total_breastfeeding_min"] == 30
    assert sdata["total_count"] == 2
