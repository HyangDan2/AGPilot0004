def test_sleep_workflow_and_midnight_crossing(client, owner_headers):
    child_res = client.post("/api/babycare/v1/children", json={
        "name": "수면아",
        "birth_date": "2026-03-01",
        "sex": "female"
    }, headers=owner_headers)
    child_id = child_res.json()["id"]

    # 1. Daytime nap
    nap = client.post(f"/api/babycare/v1/children/{child_id}/sleep", json={
        "start_time": "2026-03-05T13:00:00",
        "end_time": "2026-03-05T14:30:00",
        "is_nap": True,
        "is_ongoing": False
    }, headers=owner_headers)
    assert nap.status_code == 201
    assert nap.json()["duration_min"] == 90

    # 2. Night sleep crossing midnight: 22:00 -> next day 06:00 (8 hours = 480 min)
    night = client.post(f"/api/babycare/v1/children/{child_id}/sleep", json={
        "start_time": "2026-03-05T22:00:00",
        "end_time": "2026-03-06T06:00:00",
        "is_nap": False,
        "is_ongoing": False
    }, headers=owner_headers)
    assert night.status_code == 201
    assert night.json()["duration_min"] == 480

    # 3. Check daily summary
    summary_res = client.get(
        f"/api/babycare/v1/children/{child_id}/sleep/daily-summary?date_str=2026-03-05",
        headers=owner_headers
    )
    assert summary_res.status_code == 200
    sdata = summary_res.json()
    assert sdata["total_sleep_min"] == 90 + 480
    assert sdata["nap_sleep_min"] == 90
    assert sdata["night_sleep_min"] == 480
