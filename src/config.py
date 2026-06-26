"""
法务审核系统全局配置
所有路径、密钥、端口参数统一收敛于此，其他模块禁止硬编码
"""
import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库
DB_PATH = BASE_DIR / "law_audit.db"
DB_URL = f"sqlite:///{DB_PATH.as_posix()}"

# 文件存储目录
UPLOAD_DIR = BASE_DIR / "upload"
USER_CONTRACT_DIR = UPLOAD_DIR / "user_contract"
KB_UPLOAD_DIR = UPLOAD_DIR / "kb_upload"
SAVE_DIR = BASE_DIR / "save_audit_report"
DATASET_DIR = BASE_DIR / "dataset"
WORK_ORDER_DIR = BASE_DIR / "work_order_record"
TEMPLATE_DIR = UPLOAD_DIR / "templates"
GENERATED_CONTRACT_DIR = UPLOAD_DIR / "generated_contracts"


# 知识库
KB_DIR = BASE_DIR / "src" / "law_kb"
CHROMA_DIR = KB_DIR / "chroma_db"

# 角色配置
IDENTITY_DIR = BASE_DIR / "identity"

# 前端
WEB_DIR = BASE_DIR / "web_front"
REACT_WEB_DIR = BASE_DIR / "web_app" / "dist"

# 安全 — 生产环境务必通过环境变量 SECRET_KEY 覆盖
SECRET_KEY = os.environ.get("SECRET_KEY", "CHANGE-ME-IN-PRODUCTION")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

# 服务
HOST = os.environ.get("LAW_AUDIT_HOST", "0.0.0.0")
PORT = int(os.environ.get("LAW_AUDIT_PORT", "3330"))

# Hermes配置搜索路径（自动同步LLM模型参数）
HERMES_CONFIG_PATHS = []
_hermes_home = os.environ.get("HERMES_HOME")
if _hermes_home:
    HERMES_CONFIG_PATHS.append(Path(_hermes_home) / "config.yaml")
# 按常见安装路径搜索
for _p in [
    Path.home() / ".hermes" / "config.yaml",
    Path("/etc/hermes/config.yaml"),
]:
    if _p not in HERMES_CONFIG_PATHS:
        HERMES_CONFIG_PATHS.append(_p)

LLM_SYNC_INTERVAL = 5  # 模型同步轮询间隔（秒）

# 确保目录存在
for d in [USER_CONTRACT_DIR, KB_UPLOAD_DIR, SAVE_DIR, DATASET_DIR, WORK_ORDER_DIR, CHROMA_DIR, TEMPLATE_DIR, GENERATED_CONTRACT_DIR]:
    d.mkdir(parents=True, exist_ok=True)
