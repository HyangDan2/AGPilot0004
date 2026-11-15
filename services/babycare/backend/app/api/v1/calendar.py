from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from app.core.database import get_db
from app.models.entities import HealthEvent, User
from app.schemas.calendar import (
    HealthEventCreate, HealthEventUpdate, HealthEventRead, HealthCalendarSummary
)
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.services.calendar_service import update_event_overdue_statuses

router = APIRouter(prefix="/children/{child_id}/calendar", tags=["Health Calendar"])

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
