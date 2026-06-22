"""
Expert Bridge — External Legal Expert Context Provider
Searches the E盘 expert library for relevant legal expert profiles
and returns a formatted context string for LLM system prompts.
"""

import os


def get_expert_context(question: str) -> str:
    """Search E盘 expert library for relevant legal expert profiles.

    Reads the 'legal' expert directory under the unified multi-expert
    dispatch center and extracts description lines from each expert's
    Markdown profile. Returns a formatted context string that can be
    appended to the LLM system prompt so the AI is aware of available
    external legal experts and can reference them in its answer.

    Args:
        question: The user's legal consultation question (unused in this
                  basic implementation but available for future
                  relevance-based filtering).

    Returns:
        A multi-line string listing available external legal experts
        and their specialities, or an empty string if the directory
        is not found or contains no valid profiles.
    """
    legal_dir = "/mnt/e/通用多专家辅助调度中心/注册外部专家技能/legal"
    context_parts = []

    if not os.path.isdir(legal_dir):
        return ""

    for f in sorted(os.listdir(legal_dir)):
        if not f.endswith(".md"):
            continue

        filepath = os.path.join(legal_dir, f)
        try:
            with open(filepath, "r", encoding="utf-8") as fh:
                content = fh.read()
        except (OSError, IOError):
            continue

        # Extract the YAML front-matter description line
        expert_name = f.replace(".md", "")
        found_desc = None
        for line in content.split("\n"):
            stripped = line.strip()
            if stripped.startswith("description:"):
                found_desc = stripped.replace("description:", "", 1).strip()
                break

        if found_desc:
            context_parts.append(f"- {expert_name}: {found_desc}")

    if not context_parts:
        return ""

    return "\n".join(context_parts)
