"""
数据库模型定义与初始化
"""
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, declarative_base
import bcrypt
from .config import DB_URL

engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Organization(Base):
    """组织架构表"""
    __tablename__ = "organization"
    id = Column(Integer, primary_key=True, autoincrement=True)
    node_type = Column(String(16), nullable=False)
    name = Column(String(128), nullable=False)
    parent_id = Column(Integer, ForeignKey("organization.id"), nullable=True)
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    """用户表"""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(16), nullable=False, default="user")
    company = Column(String(128), default="")
    department = Column(String(128), default="")
    full_name = Column(String(64), default="")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    def verify_password(self, password):
        return bcrypt.checkpw(password.encode(), self.password_hash.encode())


class DeviceBinding(Base):
    __tablename__ = "device_bindings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    fingerprint_hash = Column(String(128), nullable=False, index=True)
    approved = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GuestSession(Base):
    """游客会话表"""
    __tablename__ = "guest_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    guest_token = Column(String(64), unique=True, nullable=False, index=True)
    consult_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_role = Column(String(16), nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    title = Column(String(256), nullable=False)
    description = Column(Text)
    result = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    assigned_to = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String(256), nullable=False)
    original_path = Column(String(512))
    audit_report_path = Column(String(512))
    status = Column(String(16), default="uploaded")
    risk_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text)
    role_used = Column(String(16))
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditRecord(Base):
    __tablename__ = "audit_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True)
    auditor_id = Column(Integer, ForeignKey("users.id"))
    findings = Column(JSON)
    risk_level = Column(String(16))
    report_path = Column(String(512))
    created_at = Column(DateTime, default=datetime.utcnow)


class ContractTemplate(Base):
    """合同模板表"""
    __tablename__ = "contract_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), nullable=False)           # 模板名称
    category = Column(String(64), nullable=False)         # 分类：劳动合同/采购合同/租赁合同/...
    description = Column(Text, default="")                # 模板说明
    template_file_path = Column(String(512))              # 模板文件路径(docx)
    template_text = Column(Text, default="")              # 模板纯文本内容(供LLM使用)
    fill_fields = Column(JSON, default=list)              # 可填写字段列表 [{key,label,type,required,options}]
    version = Column(Integer, default=1)                  # 版本号
    status = Column(String(16), default="active")         # active/disabled
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeneratedContract(Base):
    """已生成合同记录"""
    __tablename__ = "generated_contracts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("contract_templates.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(256), nullable=False)           # 合同标题
    filled_data = Column(JSON, default=dict)              # 用户填写的数据
    output_path = Column(String(512))                     # 生成文件路径
    status = Column(String(16), default="generated")      # generated/downloaded
    created_at = Column(DateTime, default=datetime.utcnow)



def init_db():
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                password_hash=bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode(),
                role="admin", company="系统管理", department="技术部", full_name="管理员"
            ))
            db.commit()
            print("[初始化] 管理员账号: admin/admin123")
        for u in db.query(User).filter(User.company == None).all():
            u.company = ""
            u.department = ""
            u.full_name = u.username
            u.enabled = True
        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
