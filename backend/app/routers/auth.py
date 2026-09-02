from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, Tenant, AuditLog
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user
from app.schemas.domain import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated",
        )

    token_data = {
        "sub": user.id,
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
    }
    access_token = create_access_token(token_data)
    
    # Audit log
    audit = AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        actor_name=user.name,
        actor_email=user.email,
        action="USER_LOGIN",
        entity_type="User",
        entity_id=user.id
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            tenant_id=user.tenant_id,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )

@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    # Create tenant if company name provided
    tenant_id = None
    if payload.company_name:
        import re
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', payload.company_name.lower()).strip('-')
        tenant = Tenant(name=payload.company_name, slug=slug)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    new_user = User(
        email=payload.email.strip().lower(),
        hashed_password=get_password_hash(payload.password),
        name=payload.name,
        role=payload.role,
        tenant_id=tenant_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token_data = {
        "sub": new_user.id,
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "tenant_id": new_user.tenant_id,
    }
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            name=new_user.name,
            role=new_user.role,
            tenant_id=new_user.tenant_id,
            is_active=new_user.is_active,
            created_at=new_user.created_at
        )
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
