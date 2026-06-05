"""
五重鉴权系统
"""
import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import jwt
import bcrypt
from sqlalchemy.orm import Session
from ..config import SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_DAYS
from ..database import User, DeviceBinding, GuestSession, SessionLocal, get_db


def validate_username(username: str):
    if not username or len(username) < 4 or len(username) > 20:
        raise HTTPException(400, "账号长度需为4-20位")
    if username.isdigit():
        raise HTTPException(400, "账号不能为纯数字")
    if not re.match(r"^[a-zA-Z0-9]+$", username):
        raise HTTPException(400, "账号仅允许字母和数字组合")
    if not re.search(r"[a-zA-Z]", username) or not re.search(r"[0-9]", username):
        raise HTTPException(400, "账号必须同时包含字母和数字")


def validate_password(password: str):
    if not password or len(password) < 6:
        raise HTTPException(400, "密码长度不能少于6位")
    if not re.search(r"[a-zA-Z]", password):
        raise HTTPException(400, "密码必须包含字母")
    if not re.search(r"[0-9]", password):
        raise HTTPException(400, "密码必须包含数字")


def hash_fingerprint(fp: str) -> str:
    return hashlib.sha256(fp.encode()).hexdigest()


def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        "user_id": user_id, "username": username, "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def register(username: str, password: str, db: Session,
             company: str = "", department: str = "", full_name: str = "") -> dict:
    validate_username(username)
    validate_password(password)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已被占用")
    if full_name:
        existing = db.query(User).filter(User.full_name == full_name, User.role != "admin").first()
        if existing:
            raise HTTPException(status_code=400, detail=f"人员「{full_name}」已有账号，每人仅限注册一个账号")
    user = User(
        username=username,
        password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        role="user", company=company, department=department, full_name=full_name, enabled=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role,
            "company": user.company, "department": user.department, "full_name": user.full_name}


def login(username: str, password: str, device_fingerprint: str, db: Session) -> dict:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.verify_password(password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.enabled:
        raise HTTPException(status_code=403, detail="账号已被禁用，请联系管理员")
    fp_hash = hash_fingerprint(device_fingerprint)
    if user.role == "admin":
        existing = db.query(DeviceBinding).filter(DeviceBinding.user_id == user.id, DeviceBinding.fingerprint_hash == fp_hash).first()
        if not existing:
            db.add(DeviceBinding(user_id=user.id, fingerprint_hash=fp_hash, approved=True))
            db.commit()
        elif not existing.approved:
            existing.approved = True
            db.commit()
    binding = db.query(DeviceBinding).filter(DeviceBinding.user_id == user.id, DeviceBinding.fingerprint_hash == fp_hash).first()
    if not binding:
        existing = db.query(DeviceBinding).filter(DeviceBinding.user_id == user.id).first()
        if existing:
            db.add(DeviceBinding(user_id=user.id, fingerprint_hash=fp_hash, approved=False))
            db.commit()
            raise HTTPException(status_code=403, detail="新设备登录，需管理员审批绑定")
        else:
            db.add(DeviceBinding(user_id=user.id, fingerprint_hash=fp_hash, approved=True))
            db.commit()
    elif not binding.approved:
        raise HTTPException(status_code=403, detail="设备尚未通过审批")
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_token(user.id, user.username, user.role)
    return {"token": token, "user": {
        "id": user.id, "username": user.username, "role": user.role,
        "company": user.company, "department": user.department, "full_name": user.full_name
    }}


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get("law_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return payload


async def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[dict]:
    token = request.cookies.get("law_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    return verify_token(token)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="权限不足：仅管理员可访问")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="law_token", value=token, httponly=True, secure=False, samesite="lax", max_age=JWT_EXPIRE_DAYS * 86400)


def create_guest_session(guest_token: str, db: Session) -> GuestSession:
    gs = db.query(GuestSession).filter(GuestSession.guest_token == guest_token).first()
    if not gs:
        gs = GuestSession(guest_token=guest_token, consult_count=0)
        db.add(gs)
        db.commit()
        db.refresh(gs)
    return gs
