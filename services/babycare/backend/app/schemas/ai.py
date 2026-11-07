from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any
from datetime import datetime

class SourceCitation(BaseModel):
    title: str
    organization: str
    url: Optional[str] = None
    category: str
    excerpt: Optional[str] = None

class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None
    child_id: Optional[str] = None
    use_child_context: bool = False  # Explicit user consent flag

class AIChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    reply: str
    sources: list[SourceCitation] = []
    is_emergency: bool = False
    safety_disclaimer: str
    suggested_follow_ups: list[str] = []
    used_child_context: bool = False

class AIMessageRead(BaseModel):
    id: str
    role: str
    content: str
    sources: list[SourceCitation] = []
    safety_flags: list[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AIConversationRead(BaseModel):
    id: str
    title: str
    child_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: list[AIMessageRead] = []

    model_config = ConfigDict(from_attributes=True)
