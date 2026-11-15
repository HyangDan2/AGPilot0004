from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import SleepRecord, User
from app.schemas.sleep import (
    SleepRecordCreate, SleepRecordUpdate, SleepRecordRead, SleepDailySummary
)
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access

router = APIRouter(prefix="/children/{child_id}/sleep", tags=["Sleep Tracker"])

def compute_sleep_duration(start_time: datetime, end_time: datetime = None) -> int:
    if not end_time or end_time < start_time:
        return 0
    delta = end_time - start_time
    return int(delta.total_seconds() / 60)

@router.get("", response_model=list[SleepRecordRead])
def list_sleep_records(
    child_id: str,
    target_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    query = db.query(SleepRecord).filter(SleepRecord.child_id == child.id)

    if target_date:
        try:
            d = date.fromisoformat(target_date)
            start_dt = datetime.combine(d, datetime.min.time())
            end_dt = datetime.combine(d, datetime.max.time())
            query = query.filter(SleepRecord.start_time >= start_dt, SleepRecord.start_time <= end_dt)
        except ValueError:
            pass

    return query.order_by(SleepRecord.start_time.desc()).all()

@router.post("", response_model=SleepRecordRead, status_code=status.HTTP_201_CREATED)
def create_sleep_record(
    child_id: str,
    data: SleepRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")

    duration = None
    if data.end_time and not data.is_ongoing:
        duration = compute_sleep_duration(data.start_time, data.end_time)

    # If is_ongoing, check if there's already an ongoing record
    if data.is_ongoing:
        existing_ongoing = db.query(SleepRecord).filter(
            SleepRecord.child_id == child.id,
            SleepRecord.is_ongoing == True
        ).first()
        if existing_ongoing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 진행 중인 수면 기록이 있습니다. 먼저 기존 수면을 종료해 주세요."
            )

    new_record = SleepRecord(
        child_id=child.id,
        start_time=data.start_time,
        end_time=data.end_time if not data.is_ongoing else None,
        duration_min=duration,
        is_nap=data.is_nap,
        is_ongoing=data.is_ongoing,
        notes=data.notes
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.patch("/{record_id}", response_model=SleepRecordRead)
def update_sleep_record(
    child_id: str,
    record_id: str,
    data: SleepRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(SleepRecord).filter(
        SleepRecord.id == record_id,
        SleepRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="수면 기록을 찾을 수 없습니다.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)

    if record.end_time and not record.is_ongoing:
        record.duration_min = compute_sleep_duration(record.start_time, record.end_time)

    db.commit()
    db.refresh(record)
    return record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sleep_record(
    child_id: str,
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(SleepRecord).filter(
        SleepRecord.id == record_id,
        SleepRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="수면 기록을 찾을 수 없습니다.")

    db.delete(record)
    db.commit()
    return None

@router.get("/daily-summary", response_model=SleepDailySummary)
def get_daily_sleep_summary(
    child_id: str,
    date_str: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")

    target_date = date.fromisoformat(date_str) if date_str else date.today()
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    records = db.query(SleepRecord).filter(
        SleepRecord.child_id == child.id,
        SleepRecord.start_time >= start_dt,
        SleepRecord.start_time <= end_dt
    ).all()

    ongoing = db.query(SleepRecord).filter(
        SleepRecord.child_id == child.id,
        SleepRecord.is_ongoing == True
    ).first()

    total_min = sum(r.duration_min or 0 for r in records if not r.is_ongoing)
    night_min = sum(r.duration_min or 0 for r in records if not r.is_nap and not r.is_ongoing)
    nap_min = sum(r.duration_min or 0 for r in records if r.is_nap and not r.is_ongoing)

    nap_cnt = sum(1 for r in records if r.is_nap)
    night_cnt = sum(1 for r in records if not r.is_nap)

    return SleepDailySummary(
        date=target_date.isoformat(),
        total_sleep_min=total_min,
        night_sleep_min=night_min,
        nap_sleep_min=nap_min,
        nap_count=nap_cnt,
        night_count=night_cnt,
        ongoing_sleep=SleepRecordRead.model_validate(ongoing) if ongoing else None
    )
