from app.services.growth_service import calculate_percentile, get_growth_curve

def test_korean_cdc_percentile_calculation():
    # Boy at 0 months, median weight in 2017 KDCA table is 3.34 kg -> percentile must be 50.0%
    p50_weight = calculate_percentile(3.34, "weight_kg", "male", 0.0)
    assert 49.0 <= p50_weight <= 51.0

    # Girl at 12 months, median weight is 9.76 kg -> percentile ~50.0%
    p50_girl = calculate_percentile(9.76, "weight_kg", "female", 12.0)
    assert 49.0 <= p50_girl <= 51.0

    # Underweight should yield low percentile
    p_low = calculate_percentile(2.2, "weight_kg", "male", 0.0)
    assert p_low < 5.0

    # Overweight should yield high percentile
    p_high = calculate_percentile(14.0, "weight_kg", "female", 12.0)
    assert p_high > 95.0

def test_growth_record_api(client, owner_headers):
    # Create child
    child_res = client.post("/api/babycare/v1/children", json={
        "name": "성장이",
        "birth_date": "2026-01-01",
        "sex": "female",
        "is_premature": False
    }, headers=owner_headers)
    child_id = child_res.json()["id"]

    # Add growth record
    growth_payload = {
        "measurement_date": "2026-07-01",
        "weight_kg": 7.89,
        "height_cm": 66.7,
        "head_circumference_cm": 42.2,
        "notes": "6개월 정기 측정"
    }
    growth_res = client.post(f"/api/babycare/v1/children/{child_id}/growth", json=growth_payload, headers=owner_headers)
    assert growth_res.status_code == 201
    data = growth_res.json()
    assert data["weight_percentile"] is not None
    assert 45.0 <= data["weight_percentile"] <= 55.0  # 7.89kg is exact KDCA 6-month median for girls
    assert data["height_percentile"] is not None
    assert 45.0 <= data["height_percentile"] <= 55.0

    # Growth summary
    summary_res = client.get(f"/api/babycare/v1/children/{child_id}/growth/summary", headers=owner_headers)
    assert summary_res.status_code == 200
    assert summary_res.json()["total_records"] == 1

    # Growth curves
    curves_res = client.get(f"/api/babycare/v1/children/{child_id}/growth/curves?metric=weight_kg", headers=owner_headers)
    assert curves_res.status_code == 200
    assert len(curves_res.json()["points"]) > 5
