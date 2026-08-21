from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from src.config import get_settings
from src.database import db

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    settings = get_settings()
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception()
    except JWTError:
        raise credentials_exception()

    # The payload has the same structure as we defined in NestJS Auth.types.ts
    # Let's verify the user in the database
    user = await db.user.find_unique(where={"id": user_id})
    if user is None:
        raise credentials_exception()
        
    return user

def credentials_exception():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

def require_role(allowed_roles: list[str]):
    async def role_checker(user = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return user
    return role_checker

async def verify_internal_token(x_internal_token: str = Header(default="")):
    """Gate for endpoints only NestJS should call (02-SYSTEM-ARCHITECTURE.md: internal
    NestJS -> FastAPI contract, never a user JWT). If INTERNAL_SERVICE_TOKEN isn't
    configured, this is unenforced — same dev-only "warn, don't crash" fallback used
    for Redis/S3 on the Node side, not a production posture."""
    settings = get_settings()
    if settings.INTERNAL_SERVICE_TOKEN and x_internal_token != settings.INTERNAL_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service token",
        )
