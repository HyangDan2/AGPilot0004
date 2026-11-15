from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ContentSourceRead(BaseModel):
    id: str
    name: str
    organization: str
    url: Optional[str] = None
    license: str

    model_config = ConfigDict(from_attributes=True)

class ContentArticleRead(BaseModel):
    id: str
    title: str
    category: str
    age_months_min: int
    age_months_max: int
    summary: str
    content_body: str
    is_approved: bool
    review_status: str
    version: int
    source: Optional[ContentSourceRead] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ArticleFilterParams(BaseModel):
    category: Optional[str] = None
    age_months: Optional[int] = None
    keyword: Optional[str] = None
