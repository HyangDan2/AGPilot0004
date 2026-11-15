import io
import re
import csv
import zipfile
from datetime import datetime, date, timedelta
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.entities import Child, ChildMember, FeedingRecord, SleepRecord, User
from app.services.calendar_service import generate_child_health_schedule

def detect_encoding_and_read(content: bytes) -> str:
    """Tries UTF-8, then CP949 / EUC-KR."""
    for enc in ["utf-8", "cp949", "euc-kr", "utf-16"]:
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")

def parse_day_offset(date_str: str) -> tuple[Optional[date], Optional[int], Optional[date]]:
    """
    Parses '2026-11-01 (145d)' into:
      target_date: 2026-11-01
      days_since_birth: 145
      estimated_birth_date: 2026-11-01 - 145 days = 2026-06-09
    """
    clean = date_str.strip()
    match = re.search(r'(\d{4}-\d{2}-\d{2})\s*(?:\((\d+)d\))?', clean)
    if not match:
        return None, None, None

    dt_str = match.group(1)
    target_dt = date.fromisoformat(dt_str)
    day_num = int(match.group(2)) if match.group(2) else None
    est_birth = target_dt - timedelta(days=day_num) if day_num is not None else None

    return target_dt, day_num, est_birth

def parse_csv_stream(csv_text: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Parses parenting app stat CSV into structured daily records and metadata.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    earliest_birth = None

    for r in reader:
        date_raw = r.get("date", "")
        if not date_raw:
            continue

        target_date, days_since_birth, est_birth = parse_day_offset(date_raw)
        if not target_date:
            continue

        if est_birth and earliest_birth is None:
            earliest_birth = est_birth

        def get_f(key: str) -> float:
            val = r.get(key, 0)
            try:
                return float(val) if val else 0.0
            except ValueError:
                return 0.0

        def get_i(key: str) -> int:
            val = r.get(key, 0)
            try:
                return int(float(val)) if val else 0
            except ValueError:
                return 0

        formula_ml = get_f("분유 총 양(ml)")
        formula_count = get_i("분유 횟수")
        formula_avg_ml = get_f("분유 평균량(ml)")

        breastfeeding_total_min = get_f("모유 총 시간")
        breastfeeding_count = get_i("모유 총 횟수")

        nap_duration_min = get_f("낮잠 시간")
        nap_count = get_i("낮잠 횟수")

        night_sleep_min = get_f("밤잠 시간")
        night_sleep_count = get_i("밤잠 횟수")

        diaper_stool_count = get_i("기저귀 대변 횟수")
        diaper_total_count = get_i("기저귀 총 횟수")

        tummy_time_min = get_f("터미타임 총 시간")
        tummy_time_count = get_i("터미타임 횟수")

        # Only count days that have active tracking (not future empty days)
        has_active_data = (
            formula_ml > 0 or
            breastfeeding_total_min > 0 or
            nap_duration_min > 0 or
            night_sleep_min > 0 or
            diaper_total_count > 0
        )

        rows.append({
            "date": target_date.isoformat(),
            "days_since_birth": days_since_birth,
            "has_active_data": has_active_data,
            "formula_ml": formula_ml,
            "formula_count": formula_count,
            "formula_avg_ml": formula_avg_ml,
            "breastfeeding_total_min": breastfeeding_total_min,
            "breastfeeding_count": breastfeeding_count,
            "nap_duration_min": nap_duration_min,
            "nap_count": nap_count,
            "night_sleep_min": night_sleep_min,
            "night_sleep_count": night_sleep_count,
            "total_sleep_min": nap_duration_min + night_sleep_min,
            "diaper_stool_count": diaper_stool_count,
            "diaper_total_count": diaper_total_count,
            "tummy_time_min": tummy_time_min,
            "tummy_time_count": tummy_time_count,
        })

    active_rows = [r for r in rows if r["has_active_data"]]
    active_days_count = len(active_rows)

    # Compute summary analytics
    avg_formula = round(sum(r["formula_ml"] for r in active_rows) / max(1, active_days_count), 1)
    avg_formula_cnt = round(sum(r["formula_count"] for r in active_rows) / max(1, active_days_count), 1)
    avg_nap_min = round(sum(r["nap_duration_min"] for r in active_rows) / max(1, active_days_count), 1)
    avg_night_min = round(sum(r["night_sleep_min"] for r in active_rows) / max(1, active_days_count), 1)
    avg_total_sleep_min = round(sum(r["total_sleep_min"] for r in active_rows) / max(1, active_days_count), 1)
    avg_stool_cnt = round(sum(r["diaper_stool_count"] for r in active_rows) / max(1, active_days_count), 1)

    summary = {
        "total_days_in_file": len(rows),
        "active_days_count": active_days_count,
        "estimated_birth_date": earliest_birth.isoformat() if earliest_birth else None,
        "avg_formula_ml": avg_formula,
        "avg_formula_count": avg_formula_cnt,
        "avg_nap_min": avg_nap_min,
        "avg_night_min": avg_night_min,
        "avg_night_hours": round(avg_night_min / 60.0, 1),
        "avg_total_sleep_hours": round(avg_total_sleep_min / 60.0, 1),
        "avg_diaper_stool_count": avg_stool_cnt,
    }

    return rows, summary

def process_stat_zip(zip_bytes: bytes) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    """
    Unzips and extracts csv data.
    Returns (child_name, daily_rows, summary).
    """
    child_name = "아이"
    csv_text = None

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        file_list = zf.namelist()
        
        # Try to infer child name from zip filename or files
        for fname in file_list:
            match = re.search(r'stat_(.+?)_\d+', fname)
            if match:
                child_name = match.group(1).replace('?', '').strip()
                if not child_name or child_name == '??????':
                    child_name = "태휘"

        # Prioritize 'other_stat' or 'excel_stat'
        target_f = None
        for cand in file_list:
            if "other_stat" in cand and cand.endswith(".csv"):
                target_f = cand
                break
            elif "excel_stat" in cand and cand.endswith(".csv"):
                target_f = cand

        if not target_f:
            for cand in file_list:
                if cand.endswith(".csv"):
                    target_f = cand
                    break

        if not target_f:
            raise ValueError("ZIP 파일 내에 CSV 통계 파일이 존재하지 않습니다.")

        raw_bytes = zf.read(target_f)
        csv_text = detect_encoding_and_read(raw_bytes)

    daily_rows, summary = parse_csv_stream(csv_text)
    return child_name, daily_rows, summary

def import_stat_data_to_db(
    child: Child,
    daily_rows: list[dict[str, Any]],
    db: Session
):
    """
    Persists parsed daily feeding and sleep records into child's database table.
    """
    for r in daily_rows:
        if not r["has_active_data"]:
            continue

        target_date = date.fromisoformat(r["date"])
        
        # 1. Feeding record
        if r["formula_ml"] > 0:
            start_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=12)
            existing_feed = db.query(FeedingRecord).filter(
                FeedingRecord.child_id == child.id,
                FeedingRecord.start_time >= datetime.combine(target_date, datetime.min.time()),
                FeedingRecord.start_time <= datetime.combine(target_date, datetime.max.time()),
                FeedingRecord.feeding_type == "formula"
            ).first()

            if not existing_feed:
                feed = FeedingRecord(
                    child_id=child.id,
                    feeding_type="formula",
                    start_time=start_dt,
                    amount_ml=r["formula_ml"],
                    notes=f"베이비 통계 파일에서 자동 가져옴 (총 {r['formula_count']}회)"
                )
                db.add(feed)

        # 2. Night sleep record
        if r["night_sleep_min"] > 0:
            start_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=21)
            end_dt = start_dt + timedelta(minutes=int(r["night_sleep_min"]))
            existing_sleep = db.query(SleepRecord).filter(
                SleepRecord.child_id == child.id,
                SleepRecord.start_time >= datetime.combine(target_date, datetime.min.time()),
                SleepRecord.start_time <= datetime.combine(target_date, datetime.max.time()),
                SleepRecord.is_nap == False
            ).first()

            if not existing_sleep:
                sleep = SleepRecord(
                    child_id=child.id,
                    start_time=start_dt,
                    end_time=end_dt,
                    duration_min=int(r["night_sleep_min"]),
                    is_nap=False,
                    is_ongoing=False,
                    notes=f"밤잠 {int(r['night_sleep_min'])}분 ({r['night_sleep_count']}회 분할)"
                )
                db.add(sleep)

        # 3. Nap sleep record
        if r["nap_duration_min"] > 0:
            start_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=13)
            end_dt = start_dt + timedelta(minutes=int(r["nap_duration_min"]))
            existing_nap = db.query(SleepRecord).filter(
                SleepRecord.child_id == child.id,
                SleepRecord.start_time >= datetime.combine(target_date, datetime.min.time()),
                SleepRecord.start_time <= datetime.combine(target_date, datetime.max.time()),
                SleepRecord.is_nap == True
            ).first()

            if not existing_nap:
                nap = SleepRecord(
                    child_id=child.id,
                    start_time=start_dt,
                    end_time=end_dt,
                    duration_min=int(r["nap_duration_min"]),
                    is_nap=True,
                    is_ongoing=False,
                    notes=f"낮잠 {int(r['nap_duration_min'])}분 ({r['nap_count']}회)"
                )
                db.add(nap)

    db.commit()
