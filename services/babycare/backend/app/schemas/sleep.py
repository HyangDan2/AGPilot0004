from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class SleepRecordBase(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None
    is_nap: bool = False
    is_ongoing: bool = False
    notes: Optional[str] = None

class SleepRecordCreate(SleepRecordBase):
    pass

class SleepRecordUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_min: Optional[int] = None
    is_nap: Optional[bool] = None
    is_ongoing: Optional[bool] = None
    notes: Optional[str] = None

class SleepRecordRead(SleepRecordBase):
    id: str
    child_id: str
    duration_min: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SleepDailySummary(BaseModel):
    date: str
    total_sleep_min: int
    night_sleep_min: int
    nap_sleep_min: int
    nap_count: int
    night_count: int
    ongoing_sleep: Optional[SleepRecordRead] = None
