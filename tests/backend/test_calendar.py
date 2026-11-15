def test_calendar_auto_generation_and_completion(client, owner_headers):
    # Register newborn baby
    child_res = client.post("/api/babycare/v1/children", json={
        "name": "일정이",
        "birth_date": "2026-04-01",
        "sex": "male"
    }, headers=owner_headers)
    child_id = child_res.json()["id"]

    # 1. Check auto-generated events
    events_res = client.get(f"/api/babycare/v1/children/{child_id}/calendar", headers=owner_headers)
    assert events_res.status_code == 200
    events = events_res.json()
    assert len(events) >= 15  # National immunization schedule + infant checkups

    # 2. Complete BCG event
    bcg_event = next(e for e in events if "BCG" in e["title"])
    update_res = client.patch(
        f"/api/babycare/v1/children/{child_id}/calendar/{bcg_event['id']}",
        json={
            "completed_date": "2026-04-20",
            "facility_name": "서울대병원 소아청소년과",
            "notes": "피내용 BCG 접종 완료"
        },
        headers=owner_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "completed"
    assert update_res.json()["facility_name"] == "서울대병원 소아청소년과"

    # 3. Calendar summary
    summary_res = client.get(f"/api/babycare/v1/children/{child_id}/calendar/summary", headers=owner_headers)
    assert summary_res.status_code == 200
    sdata = summary_res.json()
    assert sdata["completed_count"] >= 1
