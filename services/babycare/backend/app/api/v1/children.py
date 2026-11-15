import os
import shutil
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.entities import Child, ChildMember, User
from app.schemas.child import ChildCreate, ChildUpdate, ChildRead, ChildMemberRead, ChildMemberInvite
from app.services.auth_adapter import get_current_user
from app.services.permission_service import verify_child_access
from app.services.growth_service import calculate_age_in_months, calculate_corrected_age_in_months
from app.services.calendar_service import generate_child_health_schedule

router = APIRouter(prefix="/children", tags=["Baby Profile"])

def enrich_child_response(child: Child, role: str) -> ChildRead:
    today = date.today()
    days = (today - child.birth_date).days
    months = round(calculate_age_in_months(child.birth_date, today), 1)
    corrected = round(
        calculate_corrected_age_in_months(
            child.birth_date, today, child.is_premature, child.due_date, child.gestational_weeks
        ),
        1
    ) if child.is_premature else None

    # Member representations
    members_read = []
    for m in child.members:
        members_read.append(
            ChildMemberRead(
                id=m.id,
                user_id=m.user_id,
                role=m.role,
                user_name=m.user.name if m.user else None,
                user_email=m.user.email if m.user else None,
                invited_at=m.invited_at
            )
        )

    res = ChildRead(
        id=child.id,
        name=child.name,
        birth_date=child.birth_date,
        sex=child.sex,
        is_premature=child.is_premature,
        due_date=child.due_date,
        gestational_weeks=child.gestational_weeks,
        profile_image_url=child.profile_image_url,
        created_by=child.created_by,
        created_at=child.created_at,
        updated_at=child.updated_at,
        role=role,
        members=members_read,
        days_since_birth=days,
        months_since_birth=months,
        corrected_age_months=corrected
    )
    return res

@router.get("", response_model=list[ChildRead])
def list_children(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all children the current user has access to (owned or shared)."""
    # 1. Owned children
    owned = db.query(Child).filter(Child.created_by == current_user.id).all()
    # 2. Shared children
    memberships = db.query(ChildMember).filter(ChildMember.user_id == current_user.id).all()
    shared_child_ids = {m.child_id: m.role for m in memberships}

    results = []
    seen = set()
    for c in owned:
        seen.add(c.id)
        results.append(enrich_child_response(c, "owner"))

    for m in memberships:
        if m.child_id not in seen and m.child:
            seen.add(m.child_id)
            results.append(enrich_child_response(m.child, m.role))

    return results

@router.post("", response_model=ChildRead, status_code=status.HTTP_201_CREATED)
def create_child(data: ChildCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Registers a new baby profile and creates the initial health calendar schedule."""
    new_child = Child(
        name=data.name,
        birth_date=data.birth_date,
        sex=data.sex,
        is_premature=data.is_premature,
        due_date=data.due_date,
        gestational_weeks=data.gestational_weeks,
        profile_image_url=data.profile_image_url,
        created_by=current_user.id
    )
    db.add(new_child)
    db.commit()
    db.refresh(new_child)

    # Automatically add owner membership
    owner_member = ChildMember(
        child_id=new_child.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(owner_member)
    db.commit()

    # Automatically generate standard vaccination & checkup events
    generate_child_health_schedule(new_child, db)
    db.refresh(new_child)

    return enrich_child_response(new_child, "owner")

@router.get("/{id}", response_model=ChildRead)
def get_child(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, role = verify_child_access(id, current_user, db, min_role="viewer")
    return enrich_child_response(child, role)

@router.patch("/{id}", response_model=ChildRead)
def update_child(id: str, data: ChildUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, role = verify_child_access(id, current_user, db, min_role="caregiver")
    
    update_data = data.model_dump(exclude_unset=True)
    birth_date_changed = False
    if "birth_date" in update_data and update_data["birth_date"] != child.birth_date:
        birth_date_changed = True

    for field, val in update_data.items():
        setattr(child, field, val)
    db.commit()
    db.refresh(child)

    if birth_date_changed:
        generate_child_health_schedule(child, db)

    return enrich_child_response(child, role)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    child, role = verify_child_access(id, current_user, db, min_role="owner")
    db.delete(child)
    db.commit()
    return None

@router.post("/{id}/upload-avatar")
def upload_avatar(
    id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Secure image upload with type and size validation."""
    child, _ = verify_child_access(id, current_user, db, min_role="caregiver")

    # Validate mime type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원되지 않는 이미지 파일 형식입니다 (JPG, PNG, WEBP만 허용)."
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    safe_filename = f"child_{child.id}_{uuid.uuid4().hex[:8]}.{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Check file size
    size = os.path.getsize(dest_path)
    if size > settings.MAX_UPLOAD_SIZE_BYTES:
        os.remove(dest_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 용량이 5MB를 초과할 수 없습니다."
        )

    avatar_url = f"/api/babycare/v1/uploads/{safe_filename}"
    child.profile_image_url = avatar_url
    db.commit()

    return {"profile_image_url": avatar_url}

@router.post("/{id}/members", response_model=ChildMemberRead)
def invite_family_member(
    id: str,
    invite: ChildMemberInvite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invite family member by email with caregiver or viewer role (owner only)."""
    child, role = verify_child_access(id, current_user, db, min_role="owner")

    target_user = db.query(User).filter(User.email == invite.email).first()
    if not target_user:
        target_user = User(
            email=invite.email,
            name=invite.email.split("@")[0],
            is_active=True
        )
        db.add(target_user)
        db.commit()
        db.refresh(target_user)

    existing_member = db.query(ChildMember).filter(
        ChildMember.child_id == child.id,
        ChildMember.user_id == target_user.id
    ).first()

    if existing_member:
        existing_member.role = invite.role
        db.commit()
        db.refresh(existing_member)
        return ChildMemberRead(
            id=existing_member.id,
            user_id=target_user.id,
            role=existing_member.role,
            user_name=target_user.name,
            user_email=target_user.email,
            invited_at=existing_member.invited_at
        )

    new_member = ChildMember(
        child_id=child.id,
        user_id=target_user.id,
        role=invite.role
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    return ChildMemberRead(
        id=new_member.id,
        user_id=target_user.id,
        role=new_member.role,
        user_name=target_user.name,
        user_email=target_user.email,
        invited_at=new_member.invited_at
    )

@router.delete("/{id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_family_member(
    id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke family sharing membership (owner only)."""
    child, role = verify_child_access(id, current_user, db, min_role="owner")
    member = db.query(ChildMember).filter(
        ChildMember.id == member_id,
        ChildMember.child_id == child.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="가족 구성원을 찾을 수 없습니다.")
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="소유자는 삭제할 수 없습니다.")
    db.delete(member)
    db.commit()
    return None
