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

        expressed_milk_ml = get_f("유축수유 총 양(ml)")
        expressed_milk_count = get_i("유축수유 횟수")

        breastfeeding_left_min = get_f("모유 왼쪽 시간")
        breastfeeding_right_min = get_f("모유 오른쪽 시간")
        breastfeeding_total_min = get_f("모유 총 시간")
        breastfeeding_count = get_i("모유 총 횟수")

        solid_food_ml = get_f("이유식 총 양(ml)")
        solid_food_count = get_i("이유식 횟수")

        snack_ml = get_f("간식 총 양(ml)")
        snack_count = get_i("간식 횟수")
        water_ml = get_f("물 총 양(ml)")
        milk_ml = get_f("우유 총 양(ml)")

        nap_duration_min = get_f("낮잠 시간")
        nap_count = get_i("낮잠 횟수")

        night_sleep_min = get_f("밤잠 시간")
        night_sleep_count = get_i("밤잠 횟수")

        diaper_urine_count = get_i("기저귀 소변 횟수")
        diaper_stool_count = get_i("기저귀 대변 횟수")
        diaper_total_count = get_i("기저귀 총 횟수")

        pump_ml = get_f("유축 총 양(ml)")
        pump_count = get_i("유축 횟수")

        play_min = get_f("놀이 총 시간")
        play_count = get_i("놀이 횟수")
        tummy_time_min = get_f("터미타임 총 시간")
        tummy_time_count = get_i("터미타임 횟수")

        # Only count days that have active tracking (not future empty days)
        has_active_data = (
            formula_ml > 0 or
            expressed_milk_ml > 0 or
            breastfeeding_total_min > 0 or
            solid_food_ml > 0 or
            solid_food_count > 0 or
            nap_duration_min > 0 or
            night_sleep_min > 0 or
            diaper_total_count > 0 or
            play_min > 0 or
            tummy_time_min > 0 or
            pump_ml > 0
        )

        rows.append({
            "date": target_date.isoformat(),
            "days_since_birth": days_since_birth,
            "has_active_data": has_active_data,
            "formula_ml": formula_ml,
            "formula_count": formula_count,
            "formula_avg_ml": formula_avg_ml,
            "expressed_milk_ml": expressed_milk_ml,
            "expressed_milk_count": expressed_milk_count,
            "breastfeeding_left_min": breastfeeding_left_min,
            "breastfeeding_right_min": breastfeeding_right_min,
            "breastfeeding_total_min": breastfeeding_total_min,
            "breastfeeding_count": breastfeeding_count,
            "solid_food_ml": solid_food_ml,
            "solid_food_count": solid_food_count,
            "snack_ml": snack_ml,
            "snack_count": snack_count,
            "water_ml": water_ml,
            "milk_ml": milk_ml,
            "nap_duration_min": nap_duration_min,
            "nap_count": nap_count,
            "night_sleep_min": night_sleep_min,
            "night_sleep_count": night_sleep_count,
            "total_sleep_min": nap_duration_min + night_sleep_min,
            "diaper_urine_count": diaper_urine_count,
            "diaper_stool_count": diaper_stool_count,
            "diaper_total_count": diaper_total_count,
            "pump_ml": pump_ml,
            "pump_count": pump_count,
            "play_min": play_min,
            "play_count": play_count,
            "tummy_time_min": tummy_time_min,
            "tummy_time_count": tummy_time_count,
        })

    return rows, _summarize_daily_rows(rows, earliest_birth)


def _summarize_daily_rows(rows: list[dict[str, Any]], earliest_birth: Optional[date] = None) -> dict[str, Any]:
    active_rows = [r for r in rows if r.get("has_active_data")]
    active_days_count = len(active_rows)
    denom = max(1, active_days_count)

    avg_formula = round(sum(r.get("formula_ml", 0) for r in active_rows) / denom, 1)
    avg_formula_cnt = round(sum(r.get("formula_count", 0) for r in active_rows) / denom, 1)
    avg_expressed_ml = round(sum(r.get("expressed_milk_ml", 0) for r in active_rows) / denom, 1)
    avg_breast_min = round(sum(r.get("breastfeeding_total_min", 0) for r in active_rows) / denom, 1)
    avg_solid_ml = round(sum(r.get("solid_food_ml", 0) for r in active_rows) / denom, 1)
    avg_nap_min = round(sum(r.get("nap_duration_min", 0) for r in active_rows) / denom, 1)
    avg_night_min = round(sum(r.get("night_sleep_min", 0) for r in active_rows) / denom, 1)
    avg_total_sleep_min = round(sum(r.get("total_sleep_min", 0) for r in active_rows) / denom, 1)
    avg_urine_cnt = round(sum(r.get("diaper_urine_count", 0) for r in active_rows) / denom, 1)
    avg_stool_cnt = round(sum(r.get("diaper_stool_count", 0) for r in active_rows) / denom, 1)
    avg_play_min = round(sum(r.get("play_min", 0) for r in active_rows) / denom, 1)

    active_dates = sorted(r["date"] for r in active_rows)

    return {
        "total_days_in_file": len(rows),
        "active_days_count": active_days_count,
        "date_range_start": active_dates[0] if active_dates else None,
        "date_range_end": active_dates[-1] if active_dates else None,
        "estimated_birth_date": earliest_birth.isoformat() if earliest_birth else None,
        "avg_formula_ml": avg_formula,
        "avg_formula_count": avg_formula_cnt,
        "avg_expressed_ml": avg_expressed_ml,
        "avg_breastfeeding_min": avg_breast_min,
        "avg_solid_ml": avg_solid_ml,
        "avg_nap_min": avg_nap_min,
        "avg_night_min": avg_night_min,
        "avg_night_hours": round(avg_night_min / 60.0, 1),
        "avg_total_sleep_hours": round(avg_total_sleep_min / 60.0, 1),
        "avg_diaper_urine_count": avg_urine_cnt,
        "avg_diaper_stool_count": avg_stool_cnt,
        "avg_play_min": avg_play_min,
    }


def process_stat_zip(zip_bytes: bytes) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    """
    Unzips and merges all CSV stat files inside the archive (supporting multi-month archives).
    Returns (child_name, daily_rows, summary).
    """
    child_name = "아이"
    merged_by_date: dict[str, dict[str, Any]] = {}
    earliest_birth: Optional[date] = None

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        file_list = zf.namelist()

        # Try to infer child name from zip filename or files
        for fname in file_list:
            match = re.search(r'stat_(.+?)_\d+', fname)
            if match:
                child_name = match.group(1).replace('?', '').strip()
                if not child_name or child_name == '??????':
                    child_name = "태휘"

        other_csvs = [c for c in file_list if "other_stat" in c and c.endswith(".csv")]
        excel_csvs = [c for c in file_list if "excel_stat" in c and c.endswith(".csv")]
        fallback_csvs = [c for c in file_list if c.endswith(".csv")]
        target_files = other_csvs or excel_csvs or fallback_csvs

        if not target_files:
            raise ValueError("ZIP 파일 내에 CSV 통계 파일이 존재하지 않습니다.")

        for target_f in sorted(target_files):
            raw_bytes = zf.read(target_f)
            csv_text = detect_encoding_and_read(raw_bytes)
            rows, sub_summary = parse_csv_stream(csv_text)
            if sub_summary.get("estimated_birth_date") and earliest_birth is None:
                earliest_birth = date.fromisoformat(sub_summary["estimated_birth_date"])
            for row in rows:
                existing = merged_by_date.get(row["date"])
                if not existing or (row["has_active_data"] and not existing["has_active_data"]):
                    merged_by_date[row["date"]] = row

    all_rows = [merged_by_date[d] for d in sorted(merged_by_date.keys())]
    summary = _summarize_daily_rows(all_rows, earliest_birth)
    return child_name, all_rows, summary

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
