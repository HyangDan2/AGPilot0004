import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import AIConversation, AIMessage, User, ConsentRecord
from app.schemas.ai import AIChatRequest, AIChatResponse, AIConversationRead, AIMessageRead, SourceCitation
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.ai.rag_engine import HyangDaniRAGService

router = APIRouter(prefix="/ai", tags=["HyangDani Baby AI"])

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_hyangdani(
    data: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    RAG-grounded conversational agent for parenting knowledge with strict safety guards.
    """
    # 1. Child context consent check
    if data.use_child_context and data.child_id:
        verify_child_access(data.child_id, current_user, db, min_role="viewer")
        # Record consent in audit/consent log
        consent = ConsentRecord(
            user_id=current_user.id,
            consent_type="ai_context_sharing",
            is_agreed=True
        )
        db.add(consent)
        db.commit()

    # 2. Get or create conversation
    conv = None
    if data.conversation_id:
        conv = db.query(AIConversation).filter(
            AIConversation.id == data.conversation_id,
            AIConversation.user_id == current_user.id
        ).first()

    if not conv:
        conv_title = data.message[:30] + ("..." if len(data.message) > 30 else "")
        conv = AIConversation(
            user_id=current_user.id,
            child_id=data.child_id,
            title=conv_title
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 3. Store user message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=data.message
    )
    db.add(user_msg)
    db.commit()

    # 4. Invoke RAG engine
    rag_service = HyangDaniRAGService(db)
    response = await rag_service.answer_question(
        query=data.message,
        conversation_id=conv.id,
        child_id=data.child_id,
        use_child_context=data.use_child_context
    )

    # 5. Store assistant message
    sources_json_str = json.dumps([s.model_dump() for s in response.sources], ensure_ascii=False)
    assistant_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=response.reply,
        sources_json=sources_json_str
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    response.message_id = assistant_msg.id
    return response

@router.get("/conversations", response_model=list[AIConversationRead])
def list_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.updated_at.desc()).all()

    results = []
    for c in convs:
        msgs = []
        for m in c.messages:
            sources = []
            if m.sources_json:
                try:
                    loaded = json.loads(m.sources_json)
                    sources = [SourceCitation(**item) for item in loaded]
                except Exception:
                    pass
            msgs.append(AIMessageRead(
                id=m.id,
                role=m.role,
                content=m.content,
                sources=sources,
                safety_flags=[],
                created_at=m.created_at
            ))
        results.append(AIConversationRead(
            id=c.id,
            title=c.title,
            child_id=c.child_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
            messages=msgs
        ))
    return results
