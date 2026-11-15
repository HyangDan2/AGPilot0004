import io
import os
import zipfile
from app.services.stat_importer import process_stat_zip, parse_csv_stream

SAMPLE_ZIP_PATH = "/Users/jaehyukshim/.gemini/antigravity/brain/38697cfe-4220-4b58-8d09-9dc04d3313f0/.user_uploaded/media_1794728487179_1caa1c70.zip"

def test_parse_real_user_uploaded_zip():
    assert os.path.exists(SAMPLE_ZIP_PATH), "Uploaded zip file must exist"
    
    with open(SAMPLE_ZIP_PATH, "rb") as f:
        zip_bytes = f.read()

    child_name, daily_rows, summary = process_stat_zip(zip_bytes)
    
    assert child_name == "태휘"
    assert len(daily_rows) == 30
    assert summary["active_days_count"] == 15
    assert summary["estimated_birth_date"] == "2026-06-09"
    assert 850 <= summary["avg_formula_ml"] <= 950
    assert summary["avg_night_hours"] >= 9.0

def test_api_upload_zip(client, owner_headers):
    with open(SAMPLE_ZIP_PATH, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/babycare/v1/analytics/upload-zip",
        files={"file": ("stat_태휘_202611.zip", file_bytes, "application/zip")},
        data={"auto_create_child": "true"},
        headers=owner_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["child_name"] == "태휘"
    assert data["summary"]["active_days_count"] == 15
    assert "태휘" in data["ai_report"]
    assert "우수" in data["ai_report"] or "수유량" in data["ai_report"]
