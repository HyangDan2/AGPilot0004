from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.entities import Child, ChildMember, User

ROLE_HIERARCHY = {
    "owner": 3,
    "caregiver": 2,
    "viewer": 1
}

def verify_child_access(
    child_id: str,
    user: User,
    db: Session,
    min_role: str = "viewer"
) -> tuple[Child, str]:
    """
    Verifies that the user has at least `min_role` access to the child.
    Returns (Child, user_role).
    Raises 404 if child not found or 403 if forbidden.
    """
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="아이 정보를 찾을 수 없습니다."
        )

    # If the user is the creator, they are owner
    if child.created_by == user.id:
        return child, "owner"

    membership = db.query(ChildMember).filter(
        ChildMember.child_id == child_id,
        ChildMember.user_id == user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 아이 프로필에 대한 접근 권한이 없습니다."
        )

    user_level = ROLE_HIERARCHY.get(membership.role, 0)
    required_level = ROLE_HIERARCHY.get(min_role, 1)

    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"해당 작업을 수행하려면 {min_role} 이상의 권한이 필요합니다."
        )

    return child, membership.role
