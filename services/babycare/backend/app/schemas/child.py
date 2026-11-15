from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date, datetime

class ChildBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    birth_date: date
    sex: str = Field(..., pattern="^(male|female)$")
    is_premature: bool = False
    due_date: Optional[date] = None
    gestational_weeks: Optional[int] = Field(None, ge=20, le=44)
    profile_image_url: Optional[str] = None

class ChildCreate(ChildBase):
    pass

class ChildUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    birth_date: Optional[date] = None
    sex: Optional[str] = Field(None, pattern="^(male|female)$")
    is_premature: Optional[bool] = None
    due_date: Optional[date] = None
    gestational_weeks: Optional[int] = Field(None, ge=20, le=44)
    profile_image_url: Optional[str] = None

class ChildMemberRead(BaseModel):
    id: str
    user_id: str
    role: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    invited_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChildRead(ChildBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    role: Optional[str] = "owner"
    members: Optional[list[ChildMemberRead]] = []

    # Calculated helper fields
    days_since_birth: Optional[int] = None
    months_since_birth: Optional[float] = None
    corrected_age_months: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class ChildMemberInvite(BaseModel):
    email: str
    role: str = Field("caregiver", pattern="^(caregiver|viewer)$")
