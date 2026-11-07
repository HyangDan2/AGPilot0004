import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    role = Column(String(32), default="user", nullable=False)  # "user", "admin"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    memberships = relationship("ChildMember", back_populates="user", cascade="all, delete-orphan")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    consents = relationship("ConsentRecord", back_populates="user", cascade="all, delete-orphan")


class Child(Base):
    __tablename__ = "children"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    birth_date = Column(Date, nullable=False, index=True)
    sex = Column(String(10), nullable=False)  # "male", "female"
    is_premature = Column(Boolean, default=False, nullable=False)
    due_date = Column(Date, nullable=True)
    gestational_weeks = Column(Integer, nullable=True)
    profile_image_url = Column(String(512), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    members = relationship("ChildMember", back_populates="child", cascade="all, delete-orphan")
    growth_records = relationship("GrowthRecord", back_populates="child", cascade="all, delete-orphan")
    feeding_records = relationship("FeedingRecord", back_populates="child", cascade="all, delete-orphan")
    sleep_records = relationship("SleepRecord", back_populates="child", cascade="all, delete-orphan")
    health_events = relationship("HealthEvent", back_populates="child", cascade="all, delete-orphan")


class ChildMember(Base):
    __tablename__ = "child_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), default="owner", nullable=False)  # "owner", "caregiver", "viewer"
    invited_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child = relationship("Child", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (
        Index("idx_child_user_unique", "child_id", "user_id", unique=True),
    )


class GrowthRecord(Base):
    __tablename__ = "growth_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    measurement_date = Column(Date, nullable=False, index=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    head_circumference_cm = Column(Float, nullable=True)
    weight_percentile = Column(Float, nullable=True)
    height_percentile = Column(Float, nullable=True)
    head_circumference_percentile = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    measurement_method = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child = relationship("Child", back_populates="growth_records")


class FeedingRecord(Base):
    __tablename__ = "feeding_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    feeding_type = Column(String(32), nullable=False)  # "breastfeeding", "formula", "expressed_milk"
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    amount_ml = Column(Float, nullable=True)  # For formula and expressed milk
    left_duration_min = Column(Integer, nullable=True)  # For breastfeeding
    right_duration_min = Column(Integer, nullable=True)  # For breastfeeding
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child = relationship("Child", back_populates="feeding_records")


class SleepRecord(Base):
    __tablename__ = "sleep_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    duration_min = Column(Integer, nullable=True)
    is_nap = Column(Boolean, default=False, nullable=False)
    is_ongoing = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child = relationship("Child", back_populates="sleep_records")


class HealthScheduleRule(Base):
    __tablename__ = "health_schedule_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_type = Column(String(32), nullable=False, index=True)  # "vaccine", "checkup"
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    target_age_months_min = Column(Integer, nullable=False)
    target_age_months_max = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    official_source = Column(String(255), nullable=True)
    is_mandatory = Column(Boolean, default=True, nullable=False)
    order_num = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    health_events = relationship("HealthEvent", back_populates="rule")


class HealthEvent(Base):
    __tablename__ = "health_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(36), ForeignKey("health_schedule_rules.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(32), nullable=False)  # "vaccine", "checkup", "hospital"
    title = Column(String(128), nullable=False)
    scheduled_date = Column(Date, nullable=False, index=True)
    completed_date = Column(Date, nullable=True)
    status = Column(String(32), default="scheduled", nullable=False)  # "scheduled", "completed", "overdue"
    is_self_reported = Column(Boolean, default=True, nullable=False)
    facility_name = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    child = relationship("Child", back_populates="health_events")
    rule = relationship("HealthScheduleRule", back_populates="health_events")


class ContentSource(Base):
    __tablename__ = "content_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False)
    organization = Column(String(128), nullable=False)
    url = Column(String(512), nullable=True)
    license = Column(String(128), default="KOGL Type 1", nullable=False)  # e.g. 공공누리 제1유형
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    articles = relationship("ContentArticle", back_populates="source")


class ContentArticle(Base):
    __tablename__ = "content_articles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("content_sources.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False, index=True)  # Newborn Care, Feeding, Sleep, Development, etc.
    age_months_min = Column(Integer, default=0, nullable=False)
    age_months_max = Column(Integer, default=72, nullable=False)
    summary = Column(Text, nullable=False)
    content_body = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=True, nullable=False)
    review_status = Column(String(32), default="reviewed", nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    source = relationship("ContentSource", back_populates="articles")


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    child_id = Column(String(36), ForeignKey("children.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), default="육아 상담", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.created_at")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    sources_json = Column(Text, nullable=True)  # JSON string of citation metadata
    safety_flags_json = Column(Text, nullable=True)  # JSON string of safety tags
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("AIConversation", back_populates="messages")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    consent_type = Column(String(64), nullable=False)  # "profile_storage", "ai_context_sharing", "terms_of_service"
    is_agreed = Column(Boolean, default=True, nullable=False)
    consented_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String(64), nullable=True)

    user = relationship("User", back_populates="consents")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(64), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
