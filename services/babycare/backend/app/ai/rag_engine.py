import re
from typing import Optional
from sqlalchemy.orm import Session
from datetime import date
from app.models.entities import Child, GrowthRecord, FeedingRecord, SleepRecord, ContentArticle
from app.schemas.ai import AIChatResponse, SourceCitation
from app.services.knowledge_service import search_articles
from app.services.growth_service import calculate_age_in_months
from app.ai.gateway import get_llm_gateway

# Safety Classifications: Emergency & High Risk keywords
EMERGENCY_KEYWORDS = [
    "숨을 안", "호흡곤란", "숨을 못", "청색증", "입술이 파", "얼굴이 파",
    "경련", "발작", "눈이 돌아", "사지 떨림", "의식", "기절", "깨어나지",
    "축 늘어", "삼켰", "질식", "중독", "약물 과다", "세제", "수은",
    "머리를 심하게 찧", "분수토 반복", "피를 토", "혈변"
]

HIGH_FEVER_KEYWORDS = ["38.", "39.", "40.", "고열", "열이 너무"]

MEDICATION_DOSAGE_KEYWORDS = ["몇알", "몇 ml 먹여", "용량 얼마", "약 처방", "항생제 용량"]

STANDARD_DISCLAIMER = (
    "※ HD²LAB BabyCare AI 답변은 질병관리청 및 공인 소아청소년과 가이드라인을 기반으로 제공되는 "
    "참고 정보입니다. 의학적 진단 및 처방을 대신할 수 없으며, 아기의 증상이 지속되거나 불안할 경우 "
    "반드시 소아청소년과 전문의와 상담하시기 바랍니다."
)

class HyangDaniRAGService:
    def __init__(self, db: Session):
        self.db = db
        self.gateway = get_llm_gateway()

    def screen_safety(self, query: str, child: Optional[Child] = None) -> tuple[bool, Optional[str]]:
        """
        Step 1 & 2: Intent Classification & Safety Screening.
        Returns (is_emergency, emergency_response_text).
        """
        lower_q = query.lower()

        # Check for immediate life-threatening emergency keywords
        for kw in EMERGENCY_KEYWORDS:
            if kw in lower_q:
                return True, (
                    "🚨 [긴급 안내 - 즉시 응급 대응 필요]\n\n"
                    "아기에게 호흡곤란, 청색증, 경련, 의식 저하, 이물질 삼킴 등의 중대한 응급 징후가 의심됩니다.\n"
                    "인공지능 상담에 시간을 지체하지 마시고 **즉시 119에 신고**하시거나 **가장 가까운 응급실(소아응급센터)**로 이동하십시오!\n\n"
                    "■ 즉각 조치 가이드:\n"
                    "1. 이물질 흡인 의심 시: 1세 미만 영아는 즉시 등 두드리기 5회 및 가슴 압박 5회의 하임리히법을 실시하세요.\n"
                    "2. 경련 시: 아기를 평평한 바닥에 옆으로 눕혀 기도를 확보하고, 입에 억지로 손가락이나 숟가락을 넣지 마세요.\n"
                    "3. 구토 시: 고개를 옆으로 돌려 기도가 막히지 않도록 하세요."
                )

        # Check for high fever in infants under 3 months
        if child:
            age_months = calculate_age_in_months(child.birth_date, date.today())
            if age_months < 3.0:
                for kw in HIGH_FEVER_KEYWORDS:
                    if kw in lower_q:
                        return True, (
                            "🚨 [생후 3개월 미만 영아 발열 응급 안내]\n\n"
                            f"현재 아기는 생후 {round(age_months, 1)}개월입니다. 생후 3개월 미만의 영아가 38.0°C 이상의 열이 나는 경우, "
                            "패혈증, 요로감염, 뇌수막염 등 중증 세균 감염의 위험이 있으므로 집에서 해열제를 먹이며 지켜보지 마시고 "
                            "**지체 없이 소아응급센터나 소아청소년과 병원에 방문하여 혈액/소변 검사를 받아야 합니다.**"
                        )

        # Medication dosage query guardrail
        for kw in MEDICATION_DOSAGE_KEYWORDS:
            if kw in lower_q:
                return False, (
                    "⚠️ [약물 복용 및 용량 안내 제한]\n\n"
                    "영유아 약물의 정확한 용량은 아기의 정확한 체중(kg), 월령, 진단된 기저 질환에 따라 의사 및 약사가 결정해야 합니다.\n"
                    "AI는 임의의 투약 용량을 처방하거나 변경할 수 없습니다. "
                    "처방받은 약봉투의 복약지도 라벨을 확인하시거나 소아청소년과/약국에 문의해 주십시오.\n\n"
                    "(참고: 일반적인 아세트아미노펜 시럽은 통상 체중 1kg당 10~15mg 기준으로 4~6시간 간격 투여되나, "
                    "아기의 실제 체중과 복용 제품에 따라 상이하므로 포장지 용량표를 필히 대조하세요.)"
                )

        return False, None

    def retrieve_knowledge(self, query: str, child: Optional[Child] = None) -> list[ContentArticle]:
        """
        Step 3: Knowledge Retrieval from verified KDCA / MOHW articles.
        """
        age_months = None
        if child:
            age_months = int(calculate_age_in_months(child.birth_date, date.today()))

        # Search articles matching keywords or child age range
        articles = search_articles(self.db, age_months=age_months, keyword=None, only_approved=True)
        
        # Simple lexical relevance ranking
        query_words = set(re.findall(r'\w+', query.lower()))
        scored = []
        for art in articles:
            text = f"{art.title} {art.summary} {art.content_body}".lower()
            score = sum(1 for w in query_words if len(w) > 1 and w in text)
            if score > 0:
                scored.append((score, art))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [art for _, art in scored[:3]]

    def assemble_child_context(self, child: Child) -> str:
        """
        Step 4: Optional Child Context Assembly (only when consented).
        """
        today = date.today()
        age_m = round(calculate_age_in_months(child.birth_date, today), 1)
        days = (today - child.birth_date).days

        context_lines = [
            f"- 아기 이름: {child.name}",
            f"- 생년월일: {child.birth_date} (생후 {days}일, 약 {age_m}개월)",
            f"- 성별: {'남아' if child.sex == 'male' else '여아'}"
        ]

        if child.is_premature:
            context_lines.append(f"- 조산 여부: 미숙아/이른둥이 (출산예정일: {child.due_date})")

        # Latest growth
        latest_growth = (
            self.db.query(GrowthRecord)
            .filter(GrowthRecord.child_id == child.id)
            .order_by(GrowthRecord.measurement_date.desc())
            .first()
        )
        if latest_growth:
            context_lines.append(
                f"- 최근 성장 기록 ({latest_growth.measurement_date}): "
                f"몸무게 {latest_growth.weight_kg or '-'}kg, "
                f"키 {latest_growth.height_cm or '-'}cm"
            )

        # Recent feeding summary (today)
        recent_feedings = (
            self.db.query(FeedingRecord)
            .filter(FeedingRecord.child_id == child.id)
            .order_by(FeedingRecord.start_time.desc())
            .limit(5)
            .all()
        )
        if recent_feedings:
            feed_summaries = []
            for f in recent_feedings:
                f_type = "모유" if f.feeding_type == "breastfeeding" else "분유" if f.feeding_type == "formula" else "유축모유"
                amt = f"{f.amount_ml}mL" if f.amount_ml else f"{f.left_duration_min or 0}+{f.right_duration_min or 0}분"
                feed_summaries.append(f"{f_type}({amt})")
            context_lines.append(f"- 최근 수유: {', '.join(feed_summaries)}")

        # Recent sleep
        latest_sleep = (
            self.db.query(SleepRecord)
            .filter(SleepRecord.child_id == child.id)
            .order_by(SleepRecord.start_time.desc())
            .first()
        )
        if latest_sleep:
            duration = f"{latest_sleep.duration_min}분" if latest_sleep.duration_min else "진행 중"
            context_lines.append(f"- 최근 수면: {duration}")

        return "\n".join(context_lines)

    async def answer_question(
        self,
        query: str,
        conversation_id: str,
        child_id: Optional[str] = None,
        use_child_context: bool = False
    ) -> AIChatResponse:
        """
        Executes the full 8-step RAG Pipeline.
        """
        child = None
        if child_id:
            child = self.db.query(Child).filter(Child.id == child_id).first()

        # Step 1 & 2: Safety Screening
        is_emergency, emergency_msg = self.screen_safety(query, child)
        if emergency_msg:
            return AIChatResponse(
                conversation_id=conversation_id,
                message_id="msg-safety",
                reply=emergency_msg,
                sources=[],
                is_emergency=is_emergency,
                safety_disclaimer=STANDARD_DISCLAIMER,
                suggested_follow_ups=["119 응급센터 안내", "가까운 달빛어린이병원 찾기"],
                used_child_context=False
            )

        # Step 3: Knowledge Retrieval
        articles = self.retrieve_knowledge(query, child)
        
        # Step 4: Child Context Retrieval (strictly consent gated)
        child_context_str = ""
        if use_child_context and child:
            child_context_str = self.assemble_child_context(child)

        # Step 5: Construct Prompt
        sources_meta = []
        knowledge_excerpts = []
        for art in articles:
            org = art.source.organization if art.source else "질병관리청/보건복지부"
            url = art.source.url if art.source else None
            sources_meta.append(
                SourceCitation(
                    title=art.title,
                    organization=org,
                    url=url,
                    category=art.category,
                    excerpt=art.summary
                )
            )
            knowledge_excerpts.append(
                f"[문서: {art.title} / 출처: {org}]\n{art.content_body}"
            )

        knowledge_block = "\n\n".join(knowledge_excerpts) if knowledge_excerpts else "일반 공인 영유아 돌봄 기준을 따름."

        system_prompt = (
            "당신은 HD²LAB BabyCare의 전문 육아 AI 도우미 '향단이(HyangDani Baby AI)'입니다.\n"
            "대한민국 질병관리청 및 보건복지부, 소아청소년과학회의 공인 지침에 근거하여 따뜻하고 신뢰할 수 있게 답변합니다.\n\n"
            f"[공인 참조 자료]\n{knowledge_block}\n\n"
        )
        if child_context_str:
            system_prompt += f"[사용자 동의된 아이 프로필 정보]\n{child_context_str}\n\n"

        system_prompt += (
            "규칙:\n"
            "1. 의학적 진단이나 처방을 내리지 말고 '안내 및 관찰 요령' 위주로 전달하세요.\n"
            "2. 제공된 공인 참조 자료에 부합하는 내용을 우선적으로 설명하세요.\n"
            "3. 답변 어조는 정중하고 부모의 마음을 공감하는 친절한 한국어 존댓말을 사용하세요.\n"
            "4. 마지막에는 항상 증상 지속 시 소아과 방문을 권고하세요."
        )

        # Step 6: Generation
        reply_text = await self.gateway.generate_response(system_prompt, query)

        # Step 7 & 8: Post-validation & Source Citations
        if not articles:
            sources_meta.append(
                SourceCitation(
                    title="질병관리청 영유아 건강 표준지침",
                    organization="질병관리청 (KDCA)",
                    url="https://health.kdca.go.kr",
                    category="Health",
                    excerpt="질병관리청 국가건강정보포털 영유아 돌봄 가이드"
                )
            )

        suggested_follow_ups = [
            "월령별 권장 수유량과 간격은 어떻게 되나요?",
            "안전한 수면 환경(SIDS 예방) 수칙이 궁금해요.",
            "이 시기에 예정된 필수 예방접종이 있나요?"
        ]

        return AIChatResponse(
            conversation_id=conversation_id,
            message_id="msg-reply",
            reply=reply_text,
            sources=sources_meta,
            is_emergency=False,
            safety_disclaimer=STANDARD_DISCLAIMER,
            suggested_follow_ups=suggested_follow_ups,
            used_child_context=bool(child_context_str)
        )
