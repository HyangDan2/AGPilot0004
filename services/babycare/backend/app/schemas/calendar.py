from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime

class HealthScheduleRuleRead(BaseModel):
    id: str
    rule_type: str
    code: str
    name: str
    target_age_months_min: int
    target_age_months_max: int
    description: Optional[str] = None
    official_source: Optional[str] = None
    is_mandatory: bool
    order_num: int

    model_config = ConfigDict(from_attributes=True)

class HealthEventBase(BaseModel):
    event_type: str = Field(..., pattern="^(vaccine|checkup|hospital)$")
    title: str = Field(..., min_length=1, max_length=128)
    scheduled_date: date
    completed_date: Optional[date] = None
    status: str = Field("scheduled", pattern="^(scheduled|completed|overdue)$")
    is_self_reported: bool = True
    facility_name: Optional[str] = None
    notes: Optional[str] = None
    rule_id: Optional[str] = None

class HealthEventCreate(HealthEventBase):
    pass

class HealthEventUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(scheduled|completed|overdue)$")
    is_self_reported: Optional[bool] = None
    facility_name: Optional[str] = None
    notes: Optional[str] = None

class HealthEventRead(HealthEventBase):
    id: str
    child_id: str
    created_at: datetime
    rule: Optional[HealthScheduleRuleRead] = None

    model_config = ConfigDict(from_attributes=True)

class HealthCalendarSummary(BaseModel):
    upcoming_events: list[HealthEventRead]
    overdue_events: list[HealthEventRead]
    completed_count: int
    total_count: int
