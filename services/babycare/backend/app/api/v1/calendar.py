import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Optional
from app.core.database import get_db
from app.models.entities import HealthEvent, User
from app.schemas.calendar import (
    HealthEventCreate, HealthEventUpdate, HealthEventRead, HealthCalendarSummary
)
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.services.calendar_service import update_event_overdue_statuses
from app.knowledge.health_rules_data import VACCINATION_RULES, CHECKUP_RULES

router = APIRouter(prefix="/children/{child_id}/calendar", tags=["Health Calendar"])
public_calendar_router = APIRouter(prefix="/health-rules", tags=["Health Calendar"])

@router.get("", response_model=list[HealthEventRead])
def list_health_events(
    child_id: str,
    event_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    update_event_overdue_statuses(child.id, db)

    query = db.query(HealthEvent).filter(HealthEvent.child_id == child.id)
    if event_type:
        query = query.filter(HealthEvent.event_type == event_type)

    return query.order_by(HealthEvent.scheduled_date.asc()).all()

@router.post("", response_model=HealthEventRead, status_code=status.HTTP_201_CREATED)
def create_custom_health_event(
    child_id: str,
    data: HealthEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    
    new_event = HealthEvent(
        child_id=child.id,
        rule_id=data.rule_id,
        event_type=data.event_type,
        title=data.title,
        scheduled_date=data.scheduled_date,
        completed_date=data.completed_date,
        status=data.status,
        is_self_reported=True,
        facility_name=data.facility_name,
        notes=data.notes
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.patch("/{event_id}", response_model=HealthEventRead)
def update_health_event(
    child_id: str,
    event_id: str,
    data: HealthEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    event = db.query(HealthEvent).filter(
        HealthEvent.id == event_id,
        HealthEvent.child_id == child.id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="건강 일정을 찾을 수 없습니다.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(event, field, val)

    # If completed_date is set, auto-update status to completed
    if event.completed_date and event.status != "completed":
        event.status = "completed"

    db.commit()
    db.refresh(event)
    return event

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_event(
    child_id: str,
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    event = db.query(HealthEvent).filter(
        HealthEvent.id == event_id,
        HealthEvent.child_id == child.id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="건강 일정을 찾을 수 없습니다.")

    db.delete(event)
    db.commit()
    return None

@router.get("/summary", response_model=HealthCalendarSummary)
def get_calendar_summary(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    update_event_overdue_statuses(child.id, db)

    today = date.today()
    all_events = db.query(HealthEvent).filter(HealthEvent.child_id == child.id).all()

    upcoming = [e for e in all_events if e.status == "scheduled" and e.scheduled_date >= today]
    upcoming.sort(key=lambda x: x.scheduled_date)

    overdue = [e for e in all_events if e.status == "overdue"]
    overdue.sort(key=lambda x: x.scheduled_date)

    completed_cnt = sum(1 for e in all_events if e.status == "completed")

    return HealthCalendarSummary(
        upcoming_events=[HealthEventRead.model_validate(e) for e in upcoming[:5]],
        overdue_events=[HealthEventRead.model_validate(e) for e in overdue],
        completed_count=completed_cnt,
        total_count=len(all_events)
    )


def _compute_scheduled_date(birth: date, months_min: float) -> str:
    days = int(round(months_min * 30.4375))
    return (birth + timedelta(days=days)).isoformat()


@public_calendar_router.get("/live")
def get_live_health_rules(birth_date: Optional[str] = Query(None, description="YYYY-MM-DD")):
    """
    Returns live national immunization (NIP) and infant health checkup rules.
    Supports optional live JSON override on disk and dynamic D-Day/date calculation
    for local-first (unauthenticated) baby profiles.
    """
    override_path = os.getenv("HEALTH_RULES_LIVE_JSON", "./data/health_rules_live.json")
    vaccinations = VACCINATION_RULES
    checkups = CHECKUP_RULES
    version = "2026.11-nip"
    updated_at = "2026-11-16"

    if os.path.exists(override_path):
        try:
            with open(override_path, "r", encoding="utf-8") as f:
                custom = json.load(f)
            vaccinations = custom.get("vaccinations", vaccinations)
            checkups = custom.get("checkups", checkups)
            version = custom.get("version", version)
            updated_at = custom.get("updated_at", updated_at)
        except Exception:
            pass

    parsed_birth: Optional[date] = None
    if birth_date:
        try:
            parsed_birth = date.fromisoformat(birth_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="birth_date 형식은 YYYY-MM-DD 여야 합니다.")

    def _enrich(rule: dict, event_type: str) -> dict:
        item = {**rule, "event_type": event_type}
        if parsed_birth:
            sched = _compute_scheduled_date(parsed_birth, float(rule.get("target_age_months_min", 0)))
            item["scheduled_date"] = sched
            item["d_day"] = (date.fromisoformat(sched) - date.today()).days
        return item

    return {
        "version": version,
        "updated_at": updated_at,
        "source": "질병관리청 예방접종도우미 (NIP) · 국민건강보험공단 영유아 건강검진",
        "vaccinations": [_enrich(r, "vaccination") for r in vaccinations],
        "checkups": [_enrich(r, "checkup") for r in checkups],
    }
