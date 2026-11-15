from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import GrowthRecord, User
from app.schemas.growth import (
    GrowthRecordCreate, GrowthRecordUpdate, GrowthRecordRead,
    GrowthSummary, GrowthPercentileReference
)
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.services.growth_service import (
    calculate_age_in_months, calculate_corrected_age_in_months,
    calculate_percentile, get_growth_curve
)

router = APIRouter(prefix="/children/{child_id}/growth", tags=["Growth Tracker"])

def compute_record_percentiles(child, rec: GrowthRecord):
    # Determine effective age (chronological or corrected for premature infants)
    age_m = calculate_corrected_age_in_months(
        child.birth_date,
        rec.measurement_date,
        child.is_premature,
        child.due_date,
        child.gestational_weeks
    ) if child.is_premature else calculate_age_in_months(child.birth_date, rec.measurement_date)

    rec.weight_percentile = calculate_percentile(rec.weight_kg, "weight_kg", child.sex, age_m)
    rec.height_percentile = calculate_percentile(rec.height_cm, "height_cm", child.sex, age_m)
    rec.head_circumference_percentile = calculate_percentile(rec.head_circumference_cm, "head_circumference_cm", child.sex, age_m)

@router.get("", response_model=list[GrowthRecordRead])
def list_growth_records(child_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    records = db.query(GrowthRecord).filter(
        GrowthRecord.child_id == child.id
    ).order_by(GrowthRecord.measurement_date.asc()).all()
    return records

@router.post("", response_model=GrowthRecordRead, status_code=status.HTTP_201_CREATED)
def create_growth_record(
    child_id: str,
    data: GrowthRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    
    new_record = GrowthRecord(
        child_id=child.id,
        measurement_date=data.measurement_date,
        weight_kg=data.weight_kg,
        height_cm=data.height_cm,
        head_circumference_cm=data.head_circumference_cm,
        notes=data.notes,
        measurement_method=data.measurement_method
    )
    compute_record_percentiles(child, new_record)

    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.patch("/{record_id}", response_model=GrowthRecordRead)
def update_growth_record(
    child_id: str,
    record_id: str,
    data: GrowthRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(GrowthRecord).filter(
        GrowthRecord.id == record_id,
        GrowthRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="성장 기록을 찾을 수 없습니다.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(record, field, val)

    compute_record_percentiles(child, record)
    db.commit()
    db.refresh(record)
    return record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_growth_record(
    child_id: str,
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    child, _ = verify_child_access(child_id, current_user, db, min_role="caregiver")
    record = db.query(GrowthRecord).filter(
        GrowthRecord.id == record_id,
        GrowthRecord.child_id == child.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="성장 기록을 찾을 수 없습니다.")

    db.delete(record)
    db.commit()
    return None

@router.get("/curves", response_model=GrowthPercentileReference)
def get_growth_curves(
    child_id: str,
    metric: str = "weight_kg",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns official 2017 KDCA growth percentile curves (P3, P50, P97)."""
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    points = get_growth_curve(metric, child.sex)
    return GrowthPercentileReference(metric=metric, points=points)

@router.get("/summary", response_model=GrowthSummary)
def get_growth_summary(child_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, _ = verify_child_access(child_id, current_user, db, min_role="viewer")
    records = db.query(GrowthRecord).filter(
        GrowthRecord.child_id == child.id
    ).order_by(GrowthRecord.measurement_date.desc()).limit(2).all()

    latest = records[0] if len(records) > 0 else None
    prev = records[1] if len(records) > 1 else None

    weight_diff = None
    height_diff = None
    if latest and prev:
        if latest.weight_kg and prev.weight_kg:
            weight_diff = round(latest.weight_kg - prev.weight_kg, 2)
        if latest.height_cm and prev.height_cm:
            height_diff = round(latest.height_cm - prev.height_cm, 2)

    total_count = db.query(GrowthRecord).filter(GrowthRecord.child_id == child.id).count()

    return GrowthSummary(
        latest_record=GrowthRecordRead.model_validate(latest) if latest else None,
        previous_record=GrowthRecordRead.model_validate(prev) if prev else None,
        weight_change_kg=weight_diff,
        height_change_cm=height_diff,
        total_records=total_count
    )
