from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import ContentArticle
from app.schemas.knowledge import ContentArticleRead
from app.services.knowledge_service import search_articles

router = APIRouter(prefix="/articles", tags=["Parenting Knowledge"])

@router.get("", response_model=list[ContentArticleRead])
def get_articles(
    category: str = None,
    age_months: int = None,
    keyword: str = None,
    db: Session = Depends(get_db)
):
    """
    Publicly accessible parenting knowledge search.
    Filter by category, age_months, or keyword.
    """
    articles = search_articles(
        db=db,
        category=category,
        age_months=age_months,
        keyword=keyword,
        only_approved=True
    )
    return articles

@router.get("/{id}", response_model=ContentArticleRead)
def get_article(id: str, db: Session = Depends(get_db)):
    article = db.query(ContentArticle).filter(
        ContentArticle.id == id,
        ContentArticle.is_approved == True
    ).first()
    if not article:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    return article
