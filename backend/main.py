"""
main.py — FastAPI Application Entrypoint for Support Memory Copilot
"""

import sys
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add repo root to sys.path so backend modules resolve cleanly
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.routes.tickets import router as tickets_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("copilot-backend")

app = FastAPI(
    title="Support Memory Copilot API",
    description="Backend API for Support Memory Copilot with Hindsight memory & Groq LLM",
    version="1.0.0"
)

# CORS configuration (allow frontend on port 5173 / any local dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api base path (TRS §4)
app.include_router(tickets_router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "support-memory-copilot",
        "contract": "TRS.md-v1"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
