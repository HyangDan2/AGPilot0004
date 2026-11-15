from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class FeedingRecordBase(BaseModel):
    feeding_type: str = Field(..., pattern="^(breastfeeding|formula|expressed_milk)$")
    start_time: datetime
    end_time: Optional[datetime] = None
    amount_ml: Optional[float] = Field(None, ge=0, le=1000)
    left_duration_min: Optional[int] = Field(None, ge=0, le=120)
    right_duration_min: Optional[int] = Field(None, ge=0, le=120)
    notes: Optional[str] = None

class FeedingRecordCreate(FeedingRecordBase):
    pass

class FeedingRecordUpdate(BaseModel):
    feeding_type: Optional[str] = Field(None, pattern="^(breastfeeding|formula|expressed_milk)$")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    amount_ml: Optional[float] = Field(None, ge=0, le=1000)
    left_duration_min: Optional[int] = Field(None, ge=0, le=120)
    right_duration_min: Optional[int] = Field(None, ge=0, le=120)
    notes: Optional[str] = None

class FeedingRecordRead(FeedingRecordBase):
    id: str
    child_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FeedingDailySummary(BaseModel):
    date: str
    total_amount_ml: float
    total_breastfeeding_min: int
    formula_count: int
    breastfeeding_count: int
    expressed_milk_count: int
    total_count: int
