from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.entities import FeedingRecord, User
from app.schemas.feeding import (
    FeedingRecordCreate, FeedingRecordUpdate, FeedingRecordRead, FeedingDailySummary
)
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access

router = APIRouter(prefix="/children/{child_id}/feeding", tags=["Feeding Tracker"])

@router.get("", response_model=list[FeedingRecordRead])
def list_feeding_records(
    child_id: str,
    target_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    query = db.query(FeedingRecord).filter(FeedingRecord.child_id == child.id)
    
    if target_date:
        try:
            d = date.fromisoformat(target_date)
            start_dt = datetime.combine(d, datetime.min.time())
            end_dt = datetime.combine(d, datetime.max.time())
            query = query.filter(FeedingRecord.start_time >= start_dt, FeedingRecord.start_time <= end_dt)
        except ValueError:
            pass

    records = query.order_by(FeedingRecord.start_time.desc()).all()
    return records

@router.post("", response_model=FeedingRecordRead, status_code=status.HTTP_201_CREATED)
def create_feeding_record(
    child_id: str,
    data: FeedingRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")

    # Validation: if breastfeeding, duration should be provided; if formula, amount_ml should be provided
    if data.feeding_type in ["formula", "expressed_milk"] and data.amount_ml is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="분유 또는 유축모유 수유 시 수유량(mL)을 입력해야 합니다."
        )

    new_record = FeedingRecord(
        child_id=child.id,
        feeding_type=data.feeding_type,
        start_time=data.start_time,
        end_time=data.end_time,
        amount_ml=data.amount_ml,
        left_duration_min=data.left_duration_min,
        right_duration_min=data.right_duration_min,
        notes=data.notes
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.patch("/{record_id}", response_model=FeedingRecordRead)
def update_feeding_record(
    child_id: str,
    record_id: str,
    data: FeedingRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(FeedingRecord).filter(
        FeedingRecord.id == record_id,
        FeedingRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="수유 기록을 찾을 수 없습니다.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)

    db.commit()
    db.refresh(record)
    return record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feeding_record(
    child_id: str,
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(FeedingRecord).filter(
        FeedingRecord.id == record_id,
        FeedingRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="수유 기록을 찾을 수 없습니다.")

    db.delete(record)
    db.commit()
    return None

@router.get("/daily-summary", response_model=FeedingDailySummary)
def get_daily_feeding_summary(
    child_id: str,
    date_str: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    
    target_date = date.fromisoformat(date_str) if date_str else date.today()
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    records = db.query(FeedingRecord).filter(
        FeedingRecord.child_id == child.id,
        FeedingRecord.start_time >= start_dt,
        FeedingRecord.start_time <= end_dt
    ).all()

    total_ml = sum(r.amount_ml or 0.0 for r in records if r.feeding_type in ["formula", "expressed_milk"])
    total_bf_min = sum((r.left_duration_min or 0) + (r.right_duration_min or 0) for r in records if r.feeding_type == "breastfeeding")
    
    formula_count = sum(1 for r in records if r.feeding_type == "formula")
    bf_count = sum(1 for r in records if r.feeding_type == "breastfeeding")
    expressed_count = sum(1 for r in records if r.feeding_type == "expressed_milk")

    return FeedingDailySummary(
        date=target_date.isoformat(),
        total_amount_ml=round(total_ml, 1),
        total_breastfeeding_min=total_bf_min,
        formula_count=formula_count,
        breastfeeding_count=bf_count,
        expressed_milk_count=expressed_count,
        total_count=len(records)
    )
