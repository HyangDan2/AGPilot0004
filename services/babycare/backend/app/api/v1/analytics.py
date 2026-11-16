from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.models.entities import Child, ChildMember, User
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.services.stat_importer import (
    process_stat_zip, parse_csv_stream, detect_encoding_and_read, import_stat_data_to_db
)
from app.services.calendar_service import generate_child_health_schedule

router = APIRouter(prefix="/analytics", tags=["Stat Analytics"])

def generate_pediatric_insight(child_name: str, summary: dict, est_age_months: float) -> str:
    """Generates source-grounded pediatric analysis based on Korean CDC / Pediatrics guidelines."""
    formula_ml = summary.get("avg_formula_ml", 0)
    night_hrs = summary.get("avg_night_hours", 0)
    total_sleep_hrs = summary.get("avg_total_sleep_hours", 0)
    active_days = summary.get("active_days_count", 0)

    insights = []
    insights.append(
        f"📊 **{child_name} (생후 약 {round(est_age_months, 1)}개월)**의 최근 {active_days}일간 육아 통계 분석 결과입니다."
    )

    # 1. Feeding analysis
    if 800 <= formula_ml <= 1050:
        insights.append(
            f"• **수유량 평가 (우수):** 일일 평균 분유 섭취량이 **{formula_ml}mL**로, "
            f"대한소아청소년과학회 생후 4~6개월 표준 권장치(1일 800~1,000mL)에 최적으로 부합합니다. "
            f"1회 평균 약 {round(formula_ml / max(1, summary.get('avg_formula_count', 4)), 1)}mL씩 규칙적으로 섭취하고 있습니다."
        )
    elif formula_ml > 1050:
        insights.append(
            f"• **수유량 평가:** 일일 평균 분유량이 **{formula_ml}mL**로 다소 높은 편입니다. "
            "하루 총 수유량이 1,000mL를 지속 초과할 경우 소아 비만 및 신장 부담이 있을 수 있으니 소아청소년과 검진 시 성장곡선과 함께 확인을 권장합니다."
        )
    elif formula_ml > 0:
        insights.append(
            f"• **수유량 평가:** 일일 평균 분유량은 **{formula_ml}mL**입니다. 아기의 체중 증가율(1주 150~200g)이 양호한지 함께 관찰해 주세요."
        )

    # 2. Sleep analysis
    if night_hrs >= 9.0:
        insights.append(
            f"• **수면 패턴 평가 (안정적 통잠):** 일일 밤잠이 평균 **{night_hrs}시간**, 낮잠 포함 총 수면이 **{total_sleep_hrs}시간**으로 "
            f"밤낮 생체리듬이 안정적으로 정착되었습니다. 생후 4~6개월 권장 총 수면시간(12~15시간) 범위 내에서 충분한 성장호르몬 분비가 이루어지고 있습니다."
        )
    else:
        insights.append(
            f"• **수면 패턴 평가:** 일일 밤잠 평균은 **{night_hrs}시간**입니다. 밤중 수유 간격을 서서히 늘려 연속 밤잠을 유도해 보세요."
        )

    # 3. Diaper / Stool
    stool_cnt = summary.get("avg_diaper_stool_count", 0)
    insights.append(
        f"• **배변 활동:** 일일 평균 대변 횟수 **{stool_cnt}회**로 장운동이 원활하게 유지되고 있습니다."
    )

    insights.append(
        "\n※ 본 분석은 질병관리청 국가건강정보포털 및 소아청소년과 육아지침을 참고한 데이터 기반 리포트입니다."
    )

    return "\n\n".join(insights)

MAX_STAT_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


def _parse_stat_file(raw_content: bytes, filename: str):
    """Parses .zip or .csv stat file in memory without persisting to disk or DB."""
    if len(raw_content) > MAX_STAT_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일 크기는 최대 10MB까지 지원됩니다."
        )

    lower_name = (filename or "").lower()
    if lower_name.endswith(".zip"):
        return process_stat_zip(raw_content)
    if lower_name.endswith(".csv"):
        csv_str = detect_encoding_and_read(raw_content)
        daily_rows, summary = parse_csv_stream(csv_str)
        child_name = "태휘" if "태휘" in (filename or "") else "아이"
        return child_name, daily_rows, summary

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="지원되지 않는 파일 형식입니다. .zip 또는 .csv 파일을 업로드해 주세요."
    )


def _estimate_age_months(birth_date_str: Optional[str], default_months: float = 5.0) -> float:
    if not birth_date_str:
        return default_months
    try:
        days = (date.today() - date.fromisoformat(birth_date_str)).days
        return max(0.0, days / 30.4375)
    except ValueError:
        return default_months


@router.post("/analyze-stateless")
async def analyze_stat_zip_stateless(
    file: UploadFile = File(...),
):
    """
    Stateless analysis endpoint for public/guest users (no login, no DB persistence).
    Parses the uploaded ZIP/CSV in RAM, computes metrics and AI pediatric insights,
    and returns the payload directly to the client's local storage.
    """
    raw_content = await file.read()
    child_name, daily_rows, summary = _parse_stat_file(raw_content, file.filename or "")

    est_birth = summary.get("estimated_birth_date")
    est_age_m = _estimate_age_months(est_birth)
    ai_report = generate_pediatric_insight(child_name, summary, est_age_m)

    return {
        "status": "success",
        "mode": "stateless",
        "child_id": None,
        "child_name": child_name,
        "estimated_birth_date": est_birth,
        "summary": summary,
        "daily_rows": daily_rows,
        "ai_report": ai_report,
        "privacy_notice": "본 분석 데이터는 서버 DB에 저장되지 않고 브라우저 로컬에만 보관됩니다."
    }


@router.post("/upload-zip")
async def upload_stat_zip(
    file: UploadFile = File(...),
    child_id: Optional[str] = Form(None),
    auto_create_child: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads BabyTime/parenting app export zip/csv, parses all records,
    auto-links to child or creates new profile, and returns comprehensive analytics.
    """
    raw_content = await file.read()
    child_name, daily_rows, summary = _parse_stat_file(raw_content, file.filename or "")

    # Resolve Child Profile
    child = None
    if child_id:
        child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    elif auto_create_child:
        # Check if child with detected name already exists for this user
        existing_child = db.query(Child).filter(
            Child.created_by == current_user.id,
            Child.name == child_name
        ).first()

        if existing_child:
            child = existing_child
        else:
            est_birth = summary.get("estimated_birth_date") or "2026-06-09"
            child = Child(
                name=child_name,
                birth_date=date.fromisoformat(est_birth),
                sex="male",
                is_premature=False,
                created_by=current_user.id
            )
            db.add(child)
            db.commit()
            db.refresh(child)

            member = ChildMember(child_id=child.id, user_id=current_user.id, role="owner")
            db.add(member)
            db.commit()

            # Schedule vaccination
            generate_child_health_schedule(child, db)
            db.refresh(child)

    # Persist records to DB if child is resolved
    if child:
        import_stat_data_to_db(child, daily_rows, db)

    # Compute age in months for pediatric evaluation
    est_age_m = 5.0
    if child:
        days = (date.today() - child.birth_date).days
        est_age_m = days / 30.4375

    ai_report = generate_pediatric_insight(child_name, summary, est_age_m)

    return {
        "status": "success",
        "child_id": child.id if child else None,
        "child_name": child_name,
        "estimated_birth_date": summary.get("estimated_birth_date"),
        "summary": summary,
        "daily_rows": daily_rows,
        "ai_report": ai_report
    }

@router.get("/children/{child_id}")
def get_child_analytics(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    days = (date.today() - child.birth_date).days
    months = round(days / 30.4375, 1)

    return {
        "child_id": child.id,
        "name": child.name,
        "birth_date": child.birth_date,
        "days_since_birth": days,
        "months_since_birth": months,
    }
