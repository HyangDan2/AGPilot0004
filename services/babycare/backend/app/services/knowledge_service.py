from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.entities import ContentSource, ContentArticle
from app.knowledge.parenting_articles_data import CONTENT_SOURCES_SEED, PARENTING_ARTICLES_SEED

def seed_knowledge_base(db: Session):
    """Initializes authoritative content sources and articles."""
    for src in CONTENT_SOURCES_SEED:
        existing = db.query(ContentSource).filter(ContentSource.id == src["id"]).first()
        if not existing:
            new_src = ContentSource(
                id=src["id"],
                name=src["name"],
                organization=src["organization"],
                url=src["url"],
                license=src["license"]
            )
            db.add(new_src)
    db.commit()

    for art in PARENTING_ARTICLES_SEED:
        existing_art = db.query(ContentArticle).filter(ContentArticle.title == art["title"]).first()
        if not existing_art:
            new_art = ContentArticle(
                source_id=art["source_id"],
                title=art["title"],
                category=art["category"],
                age_months_min=art["age_months_min"],
                age_months_max=art["age_months_max"],
                summary=art["summary"],
                content_body=art["content_body"].strip(),
                is_approved=art["is_approved"],
                review_status=art["review_status"],
                version=art["version"]
            )
            db.add(new_art)
    db.commit()

def search_articles(
    db: Session,
    category: str = None,
    age_months: int = None,
    keyword: str = None,
    only_approved: bool = True
) -> list[ContentArticle]:
    seed_knowledge_base(db)
    query = db.query(ContentArticle)

    if only_approved:
        query = query.filter(ContentArticle.is_approved == True)

    if category and category != "all":
        query = query.filter(ContentArticle.category == category)

    if age_months is not None:
        query = query.filter(
            ContentArticle.age_months_min <= age_months,
            ContentArticle.age_months_max >= age_months
        )

    if keyword:
        kw = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                ContentArticle.title.ilike(kw),
                ContentArticle.summary.ilike(kw),
                ContentArticle.content_body.ilike(kw)
            )
        )

    return query.order_by(ContentArticle.created_at.desc()).all()
