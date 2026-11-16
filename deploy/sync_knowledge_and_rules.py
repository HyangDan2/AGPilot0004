#!/usr/bin/env python3
"""30-minute live sync script for HD2Lab BabyCare.

1. Refreshes/validates data/health_rules_live.json for /api/babycare/v1/health-rules/live.
2. Fetches free official parenting/pediatric RSS feeds (no API key required),
   filters for infant/vaccine/nutrition relevance, summarizes via HD2AIGateway
   when available, and inserts new unique articles into content_articles.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import json
import os
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1] / "services" / "babycare" / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal, Base, engine
from app.models.entities import ContentArticle, ContentSource
from app.knowledge.health_rules_data import VACCINATION_RULES, CHECKUP_RULES
from app.ai.gateway import get_llm_gateway

KST = timezone(timedelta(hours=9))

RSS_FEEDS = [
    (
        "질병관리청 예방접종·영유아 소식",
        "https://news.google.com/rss/search?q=%EC%A7%88%EB%B3%91%EA%B4%80%EB%A6%AC%EC%B2%AD+%EC%98%88%EB%B0%A9%EC%A0%91%EC%A2%85+OR+%EC%98%81%EC%9C%A0%EC%95%84&hl=ko&gl=KR&ceid=KR:ko",
        "Health & Safety",
    ),
    (
        "소아청소년과 육아·수유·이유식 소식",
        "https://news.google.com/rss/search?q=%EC%86%8C%EC%95%84%EC%B2%AD%EC%86%8C%EB%85%84%EA%B3%BC+%EC%9C%A1%EC%95%84+OR+%EC%88%98%EC%9C%A0+OR+%EC%9D%B4%EC%9C%A0%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko",
        "Feeding & Nutrition",
    ),
]

RELEVANCE_KEYWORDS = (
    "영유아", "소아", "아기", "신생아", "예방접종", "백신",
    "이유식", "분유", "모유", "수면", "육아", "어린이", "검진",
)


def sync_live_health_rules(data_dir: Path) -> None:
    """Atomically updates health_rules_live.json with schema validation."""
    data_dir.mkdir(parents=True, exist_ok=True)
    target = data_dir / "health_rules_live.json"
    tmp = data_dir / "health_rules_live.json.tmp"

    for r in VACCINATION_RULES + CHECKUP_RULES:
        if not all(k in r for k in ("code", "name", "target_age_months_min", "target_age_months_max")):
            raise ValueError(f"Invalid rule schema: {r}")

    payload = {
        "version": "2026.11-nip",
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "source": "질병관리청 예방접종도우미 (NIP) · 국민건강보험공단 영유아 건강검진",
        "vaccinations": VACCINATION_RULES,
        "checkups": CHECKUP_RULES,
    }
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, target)
    print(f"✅ Synced live health rules -> {target}")


async def summarize_article(title: str, source_name: str, link: str) -> str:
    """Uses HD2AIGateway if configured; otherwise returns a clean structured summary."""
    gateway = get_llm_gateway()
    system_prompt = (
        "당신은 HD2Lab BabyCare의 육아 정보 요약 에디터입니다. "
        "제목과 출처를 바탕으로 부모가 주의 깊게 볼 핵심 포인트를 한국어 2~3문장으로 간결하게 안내하세요. "
        "추측성 의학 진단이나 과장된 표현은 피하세요."
    )
    user_prompt = f"제목: {title}\n출처: {source_name}\n링크: {link}"
    try:
        reply = await gateway.generate_response(system_prompt, user_prompt)
        if reply and "제공된 공인 육아 지침에 기초하여" not in reply:
            return f"{reply}\n\n원문 출처: {source_name} ({link})"
    except Exception:
        pass
    return (
        f"[{source_name}] 최신 육아·소아건강 관련 소식입니다.\n\n"
        f"• 주요 내용: {title}\n"
        f"• 원문 확인: {link}"
    )


def _parse_pub_date(pub_date_raw: str) -> datetime:
    """Parses RSS pubDate into a naive UTC datetime for SQLite storage."""
    if pub_date_raw:
        try:
            dt = parsedate_to_datetime(pub_date_raw.strip())
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            pass
    return datetime.utcnow()


def prune_old_rss_articles(db, retention_days: int = 365) -> int:
    """Removes auto-synced RSS articles older than 1 year (365 days), keeping core seeded guides."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    rss_source_ids = [
        row[0]
        for row in db.query(ContentSource.id).filter(ContentSource.license == "Public RSS").all()
    ]
    if not rss_source_ids:
        return 0
    deleted = (
        db.query(ContentArticle)
        .filter(
            ContentArticle.source_id.in_(rss_source_ids),
            ContentArticle.created_at < cutoff,
        )
        .delete(synchronize_session=False)
    )
    if deleted:
        db.commit()
    return deleted


async def sync_rss_articles(max_new_per_run: int = 3) -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    added = 0

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for feed_name, feed_url, category in RSS_FEEDS:
                if added >= max_new_per_run:
                    break
                try:
                    resp = await client.get(feed_url)
                    resp.raise_for_status()
                    root = ET.fromstring(resp.text)
                except Exception as exc:
                    print(f"⚠️ RSS fetch failed ({feed_name}): {exc}")
                    continue

                source = db.query(ContentSource).filter(ContentSource.name == feed_name).first()
                if not source:
                    source = ContentSource(
                        name=feed_name,
                        organization="공공·언론 육아/보건 RSS",
                        url=feed_url,
                        license="Public RSS",
                    )
                    db.add(source)
                    db.commit()
                    db.refresh(source)

                for item in root.findall("./channel/item")[:10]:
                    if added >= max_new_per_run:
                        break
                    title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    if not title or not link:
                        continue
                    if not any(kw in title for kw in RELEVANCE_KEYWORDS):
                        continue

                    clean_title = title[:180]
                    exists = db.query(ContentArticle).filter(ContentArticle.title == clean_title).first()
                    if exists:
                        continue

                    pub_dt_utc = _parse_pub_date(item.findtext("pubDate") or "")
                    body = await summarize_article(clean_title, feed_name, link)
                    article = ContentArticle(
                        title=clean_title,
                        summary=f"{feed_name} 최신 업데이트 · {clean_title[:120]}",
                        content_body=body,
                        category=category,
                        age_months_min=0,
                        age_months_max=36,
                        source_id=source.id,
                        is_approved=True,
                        review_status="reviewed",
                        created_at=pub_dt_utc,
                        updated_at=pub_dt_utc,
                    )
                    db.add(article)
                    db.commit()
                    added += 1
                    print(f"📰 Added article ({pub_dt_utc.strftime('%Y-%m-%d')}): {clean_title}")

        pruned = prune_old_rss_articles(db, retention_days=365)
        if pruned:
            print(f"🧹 Pruned {pruned} RSS article(s) older than 365 days.")
    finally:
        db.close()

    print(f"✅ RSS sync complete: {added} new article(s) added.")
    return added


def main():
    data_dir = BACKEND_DIR / "data"
    sync_live_health_rules(data_dir)
    asyncio.run(sync_rss_articles())


if __name__ == "__main__":
    main()
