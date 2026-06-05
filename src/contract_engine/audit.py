"""
合同审核引擎：解析、风险标注、关联合同比对
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path
from ..config import SAVE_DIR
from ..law_kb.knowledge_base import search as kb_search, parse_pdf, parse_docx
from ..llm_sync.sync import call_llm


def parse_contract(file_path: str) -> str:
    """根据文件类型解析合同文本"""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return parse_pdf(file_path)
    elif ext == ".docx":
        return parse_docx(file_path)
    elif ext == ".txt":
        return Path(file_path).read_text(encoding="utf-8")
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def _clean_json_response(text: str) -> dict:
    """清理LLM返回的JSON，去除markdown代码块标记"""
    cleaned = text.strip()
    # 去掉markdown代码块
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        # 去掉结尾的代码块标记
        if "```" in cleaned:
            cleaned = cleaned[:cleaned.index("```")]
    return json.loads(cleaned.strip())


def extract_key_info(text: str) -> dict:
    """提取合同关键信息：主体、日期、条款、义务"""
    system_prompt = """你是一位专业的合同分析助手。请从合同文本中提取以下关键信息，以JSON格式返回：
{
    "parties": ["甲方名称", "乙方名称"],
    "signing_date": "签约日期",
    "validity_period": "有效期",
    "contract_amount": "合同金额",
    "key_obligations": ["主要义务1", "主要义务2"],
    "breach_clauses": ["违约条款摘要"],
    "dispute_resolution": "争议解决方式"
}
仅返回JSON，不要其他文字。"""
    import asyncio
    result = asyncio.run(call_llm(system_prompt, text[:3000]))
    try:
        return _clean_json_response(result)
    except (json.JSONDecodeError, IndexError):
        return {"raw_text": result[:500], "parse_error": True}


async def analyze_contract(text: str, kb_context: str = "") -> dict:
    """
    合同风险分析：结合知识库法条+LLM推理
    """
    kb_results = kb_search(text[:500], n_results=5)
    kb_text = chr(10).join([r["text"] for r in kb_results])

    system_prompt = """你是一位资深合同审核专家。请根据合同文本和相关法律条文，进行专业的合同风险分析。

输出格式（JSON）：
{
    "risk_level": "low/medium/high/critical",
    "risk_summary": "总体风险概述",
    "risk_points": [
        {
            "clause_text": "具体条款原文",
            "risk_type": "风险类型",
            "severity": "low/medium/high/critical",
            "suggestion": "修改建议"
        }
    ],
    "missing_clauses": ["建议补充的条款"],
    "compliance_check": "合规性评估"
}
仅返回JSON。"""

    user_msg = f"合同文本：{chr(10)}{text[:5000]}{chr(10)}{chr(10)}相关法条：{chr(10)}{kb_text}"
    if kb_context:
        user_msg += f"{chr(10)}{chr(10)}额外参考：{chr(10)}{kb_context}"

    result = await call_llm(system_prompt, user_msg)
    try:
        return _clean_json_response(result)
    except (json.JSONDecodeError, IndexError):
        return {"risk_level": "unknown", "risk_summary": result[:500], "risk_points": [], "parse_error": True}


async def generate_report(contract_id: int, analysis_result: dict) -> str:
    """生成审核报告并保存到本地"""
    report_filename = f"audit_report_{contract_id}_{datetime.now().strftime(chr(37)+"Y"+chr(37)+"m"+chr(37)+"d_"+chr(37)+"H"+chr(37)+"M"+chr(37)+"S")}.json"
    report_path = SAVE_DIR / report_filename
    report = {
        "contract_id": contract_id,
        "audit_time": datetime.now().isoformat(),
        "risk_level": analysis_result.get("risk_level", "unknown"),
        "risk_summary": analysis_result.get("risk_summary", ""),
        "risk_points": analysis_result.get("risk_points", []),
        "missing_clauses": analysis_result.get("missing_clauses", []),
        "compliance_check": analysis_result.get("compliance_check", "")
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return str(report_path)


async def compare_contracts(text_a: str, text_b: str) -> dict:
    """合同比对"""
    system_prompt = """对比两份合同，找出主要差异。返回JSON：
{"differences": [{"aspect": "差异方面", "contract_a": "A内容", "contract_b": "B内容", "significance": "high/medium/low"}], "summary": "概述"}"""
    result = await call_llm(system_prompt, f"合同A：{chr(10)}{text_a[:3000]}{chr(10)}{chr(10)}合同B：{chr(10)}{text_b[:3000]}")
    try:
        return _clean_json_response(result)
    except:
        return {"raw": result[:500]}
