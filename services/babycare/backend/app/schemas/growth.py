from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime

class GrowthRecordBase(BaseModel):
    measurement_date: date
    weight_kg: Optional[float] = Field(None, ge=0.5, le=50.0)
    height_cm: Optional[float] = Field(None, ge=20.0, le=160.0)
    head_circumference_cm: Optional[float] = Field(None, ge=15.0, le=70.0)
    notes: Optional[str] = None
    measurement_method: Optional[str] = None

class GrowthRecordCreate(GrowthRecordBase):
    pass

class GrowthRecordUpdate(BaseModel):
    measurement_date: Optional[date] = None
    weight_kg: Optional[float] = Field(None, ge=0.5, le=50.0)
    height_cm: Optional[float] = Field(None, ge=20.0, le=160.0)
    head_circumference_cm: Optional[float] = Field(None, ge=15.0, le=70.0)
    notes: Optional[str] = None
    measurement_method: Optional[str] = None

class GrowthRecordRead(GrowthRecordBase):
    id: str
    child_id: str
    weight_percentile: Optional[float] = None
    height_percentile: Optional[float] = None
    head_circumference_percentile: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GrowthCurvePoint(BaseModel):
    age_months: float
    p3: float
    p50: float
    p97: float

class GrowthPercentileReference(BaseModel):
    metric: str
    standard_name: str = "2017 Korean National Growth Charts"
    points: list[GrowthCurvePoint]

class GrowthSummary(BaseModel):
    latest_record: Optional[GrowthRecordRead] = None
    previous_record: Optional[GrowthRecordRead] = None
    weight_change_kg: Optional[float] = None
    height_change_cm: Optional[float] = None
    total_records: int = 0
