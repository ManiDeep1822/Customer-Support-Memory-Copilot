"""
config.py — Configuration and Environment Loader for Support Memory Copilot
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
ENV_PATH = REPO_ROOT / ".env"

load_dotenv(dotenv_path=ENV_PATH)

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "").strip()
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io").rstrip("/")
HINDSIGHT_BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "").strip()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
LLM_PRIMARY_MODEL = os.getenv("LLM_PRIMARY_MODEL", "openai/gpt-oss-120b").strip()
LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL", "qwen/qwen3-32b").strip()

DATA_DIR = REPO_ROOT / "data"
FILTERED_CUSTOMERS_FILE = DATA_DIR / "filtered_customers.json"
