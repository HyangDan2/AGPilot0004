from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from app.models.entities import HealthScheduleRule, HealthEvent, Child
from app.knowledge.health_rules_data import VACCINATION_RULES, CHECKUP_RULES

def seed_health_rules(db: Session):
    """Inserts or updates standard health schedule rules from the data module."""
    all_rules = [("vaccine", r) for r in VACCINATION_RULES] + [("checkup", r) for r in CHECKUP_RULES]
    
    for rule_type, r in all_rules:
        existing = db.query(HealthScheduleRule).filter(HealthScheduleRule.code == r["code"]).first()
        if not existing:
            new_rule = HealthScheduleRule(
                rule_type=rule_type,
                code=r["code"],
                name=r["name"],
                target_age_months_min=r["target_age_months_min"],
                target_age_months_max=r["target_age_months_max"],
                description=r["description"],
                official_source=r["official_source"],
                is_mandatory=r["is_mandatory"],
                order_num=r["order_num"]
            )
            db.add(new_rule)
        else:
            existing.name = r["name"]
            existing.target_age_months_min = r["target_age_months_min"]
            existing.target_age_months_max = r["target_age_months_max"]
            existing.description = r["description"]
            existing.official_source = r["official_source"]
            existing.is_mandatory = r["is_mandatory"]
            existing.order_num = r["order_num"]
    db.commit()

def generate_child_health_schedule(child: Child, db: Session):
    """
    Generates standard scheduled events for a child based on birth_date.
    Existing custom or completed records are never deleted or overridden.
    """
    seed_health_rules(db)
    rules = db.query(HealthScheduleRule).order_by(HealthScheduleRule.order_num).all()
    today = date.today()

    for rule in rules:
        # Check if an event already exists for this child & rule
        existing_event = db.query(HealthEvent).filter(
            HealthEvent.child_id == child.id,
            HealthEvent.rule_id == rule.id
        ).first()

        if existing_event:
            continue

        # Target date calculation: birth_date + target_age_months_min
        scheduled_date = child.birth_date + relativedelta(months=rule.target_age_months_min)
        
        status = "scheduled"
        # Overdue if not completed and target max age is in the past
        max_date = child.birth_date + relativedelta(months=rule.target_age_months_max) + timedelta(days=30)
        if today > max_date:
            status = "overdue"

        event = HealthEvent(
            child_id=child.id,
            rule_id=rule.id,
            event_type=rule.rule_type,
            title=rule.name,
            scheduled_date=scheduled_date,
            status=status,
            is_self_reported=False,
            notes=rule.description
        )
        db.add(event)
    
    db.commit()

def update_event_overdue_statuses(child_id: str, db: Session):
    """Refreshes status for past scheduled dates."""
    today = date.today()
    events = db.query(HealthEvent).filter(
        HealthEvent.child_id == child_id,
        HealthEvent.status == "scheduled"
    ).all()

    for ev in events:
        if ev.scheduled_date < today:
            # Check grace period (30 days)
            if (today - ev.scheduled_date).days > 30:
                ev.status = "overdue"
    db.commit()
