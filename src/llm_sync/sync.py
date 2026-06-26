"""
LLM模型同步模块
实时轮询读取Hermes全局模型配置，5个角色共用一套模型链路
无独立模型配置文件，全部对接参数由此模块统一注入
"""
import threading
import time
import yaml
import httpx
import os
import re
import logging
from pathlib import Path
from ..config import HERMES_CONFIG_PATHS, LLM_SYNC_INTERVAL

_logger = logging.getLogger("law_audit.llm")
_config_lock = threading.Lock()
_manual_model = None  # Set by switch-model API, persists until overridden


def set_manual_model(model_name: str):
    """Set manual model override that persists across sync cycles"""
    global _manual_model
    _manual_model = model_name
    with _config_lock:
        _cached_config["model"] = model_name


_cached_config = {
    "model": "unknown",
    "base_url": "",
    "api_key": "",
    "temperature": 0.7,
    "max_tokens": 4096,
    "synced": False,
    "last_sync": None,
    "source": None,
    "error": None
}


def _load_env_file(env_path):
    """解析.env文件为字典"""
    result = {}
    if not env_path.exists():
        return result
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    result[key.strip()] = val.strip().strip('"').strip("'")
    except Exception:
        pass
    return result


def _resolve_api_key(key_env, env_file_vars):
    """解析API密钥：优先系统环境变量，其次.env文件"""
    val = os.environ.get(key_env, "")
    if val and val != "***":
        return val
    val = env_file_vars.get(key_env, "")
    if val and val != "***":
        return val
    return ""


def _parse_hermes_config(config_path):
    """解析Hermes配置文件，提取当前启用的模型参数"""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        result = {}
        model_section = cfg.get("model", {})
        active_provider = model_section.get("provider", "")
        default_model = model_section.get("default", "")
        providers = cfg.get("providers", {})
        if active_provider and active_provider in providers:
            prov = providers[active_provider]
            result["base_url"] = prov.get("base_url", "")
            result["model"] = prov.get("model", default_model)
            result["temperature"] = prov.get("temperature", 0.7)
            result["max_tokens"] = prov.get("max_tokens", 4096)
            key_env = prov.get("key_env", "")
            if key_env:
                env_file = config_path.parent / ".env"
                env_vars = _load_env_file(env_file)
                result["api_key"] = _resolve_api_key(key_env, env_vars)
        elif default_model:
            result["model"] = default_model
        if not result.get("base_url"):
            custom = cfg.get("custom_providers", {})
            for name, prov in custom.items():
                result.setdefault("base_url", prov.get("base_url", ""))
                result.setdefault("api_key", prov.get("api_key", ""))
                result.setdefault("model", prov.get("model", default_model))
                break
        return result if result.get("model") and result["model"] != "unknown" else None
    except Exception as e:
        print(f"[LLM同步] 解析配置失败 {config_path}: {e}")
        return None


THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.DOTALL)


def _strip_think_tags(text):
    """剥离<think>...</think>思考内容，仅后台日志留存，前端绝不输出"""
    def _log_think(m):
        think = m.group(1).strip()
        if think:
            _logger.info("[思考过程] %s", think[:500])
        return ""
    result = THINK_PATTERN.sub(_log_think, text)
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result


def _sync_loop():
    """后台轮询线程：检查Hermes配置变化，失败时重试最多3次（间隔30秒）"""
    global _cached_config
    while True:
        success = False
        for attempt in range(1, 4):
            try:
                for config_path in HERMES_CONFIG_PATHS:
                    if config_path.exists():
                        parsed = _parse_hermes_config(config_path)
                        if parsed:
                            with _config_lock:
                                changed = (
                                    parsed.get("model") != _cached_config.get("model") or
                                    parsed.get("base_url") != _cached_config.get("base_url") or
                                    parsed.get("api_key") != _cached_config.get("api_key")
                                )
                                if changed:
                                    _cached_config.update(parsed)
                                if _manual_model:
                                    _cached_config["model"] = _manual_model
                                _cached_config["synced"] = True
                                _cached_config["last_sync"] = time.strftime("%Y-%m-%d %H:%M:%S")
                                _cached_config["source"] = str(config_path)
                                _cached_config["error"] = None
                                print(f"[LLM同步] 模型已更新: {_manual_model or parsed.get('model', 'unknown')}")
                            break
                    else:
                        success = True
                if success:
                    break
            except Exception as e:
                with _config_lock:
                    _cached_config["error"] = str(e)
                print(f"[LLM同步] 同步异常 (尝试 {attempt}/3): {e}")
            if attempt < 3:
                print(f"[LLM同步] 将在30秒后重试...")
                time.sleep(30)
        if not success:
            print(f"[LLM同步] 连续3次同步失败，等待下次轮询")
        time.sleep(LLM_SYNC_INTERVAL)


def get_llm_config():
    """获取当前缓存的模型配置"""
    with _config_lock:
        return dict(_cached_config)


async def call_llm(system_prompt, user_message, model_name=None):
    """统一LLM调用接口，自动剥离思考标签。model_name可覆盖默认模型"""
    cfg = get_llm_config()
    api_key = cfg.get("api_key", "")
    if not api_key:
        return "[LLM调用失败] API密钥未配置，请在Hermes配置中设置对应环境变量"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    active_model = model_name or cfg.get("model", "unknown")
    payload = {
        "model": active_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": cfg.get("temperature", 0.7),
        "max_tokens": cfg.get("max_tokens", 4096)
    }
    base = cfg.get("base_url", "").rstrip("/")
    if not base:
        return "[LLM调用失败] API base_url未配置"
    url = f"{base}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            raw = data["choices"][0]["message"]["content"]
            return _strip_think_tags(raw)
    except Exception as e:
        return f"[LLM调用失败] {str(e)}"


def start_sync():
    """启动后台同步线程"""
    t = threading.Thread(target=_sync_loop, daemon=True)
    t.start()
    print("[LLM同步] 后台同步线程已启动")
