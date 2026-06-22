#!/bin/bash
cd /mnt/e/hermes/law_audit_skill
export PYTHONPATH=/mnt/e/hermes/law_audit_skill
echo "Starting law_audit_skill on port 3330..."
exec /mnt/e/hermes/law_audit_skill/.venv/bin/python -u -m uvicorn src.app:app --host 0.0.0.0 --port 3330
