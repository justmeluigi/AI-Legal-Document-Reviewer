import os
import io
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from core.document_parser import DocumentParser
from core.analyzer import LegalDocumentAnalyzer
from core.schemas import ReviewReport

load_dotenv()

app = FastAPI(
    title="AI Legal Document Reviewer API",
    description="Grounded AI legal contract review, clause extraction, risk assessment, and passage citations.",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_contracts")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Mount static folder
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class AnalyzeTextRequest(BaseModel):
    text: str
    filename: Optional[str] = "Pasted_Contract.txt"
    provider: Optional[str] = "auto"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    custom_focus: Optional[str] = None


class AnalyzeSampleRequest(BaseModel):
    sample_id: str
    provider: Optional[str] = "auto"
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    custom_focus: Optional[str] = None


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>AI Legal Document Reviewer API is running. Static UI not yet created.</h1>")


@app.get("/api/health")
async def health_check():
    from core.llm_provider import is_ollama_running

    ollama_online = is_ollama_running()
    gemini_configured = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    groq_configured = bool(os.getenv("GROQ_API_KEY"))

    active_provider = "mock"
    if ollama_online:
        active_provider = "qwen"
    elif gemini_configured:
        active_provider = "gemini"
    elif openai_configured:
        active_provider = "openai"
    elif groq_configured:
        active_provider = "groq"

    return {
        "status": "healthy",
        "default_active_provider": active_provider,
        "configured_providers": {
            "qwen": ollama_online,
            "gemini": gemini_configured,
            "openai": openai_configured,
            "groq": groq_configured,
            "mock": True
        },
        "local_model": "qwen3.5:2b (Ollama)" if ollama_online else "Not detected"
    }


@app.get("/api/sample-contracts")
async def list_sample_contracts():
    samples = [
        {
            "id": "sample_saas_vendor_biased.pdf",
            "name": "CloudScale SaaS Agreement (High Risk)",
            "description": "Enterprise cloud subscription with unilateral uncapped indemnification, $100 liability ceiling, aggressive 36-month auto-renewal, and AI data harvesting.",
            "category": "SaaS / Technology",
            "expected_risk": "CRITICAL RISK (98/100)"
        },
        {
            "id": "sample_consulting_agreement.pdf",
            "name": "Independent Consulting Agreement (Moderate/High Risk)",
            "description": "Advisory services agreement featuring an overbroad 2-year worldwide non-compete covenant and extensive IP work-for-hire assignment.",
            "category": "Employment & Services",
            "expected_risk": "HIGH RISK (60/100)"
        },
        {
            "id": "sample_mutual_nda.pdf",
            "name": "Mutual Non-Disclosure Agreement (Standard Low Risk)",
            "description": "Standard balanced bilateral confidentiality agreement with standard 5 carve-outs and reasonable 3-year term.",
            "category": "Corporate / NDA",
            "expected_risk": "LOW RISK (26/100)"
        }
    ]
    return {"samples": samples}


@app.get("/api/sample-contracts/{sample_id}/download")
async def download_sample(sample_id: str):
    file_path = os.path.join(SAMPLE_DIR, sample_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Sample contract not found")
    return FileResponse(file_path, filename=sample_id, media_type="application/pdf")


@app.post("/api/analyze-file", response_model=ReviewReport)
async def analyze_file(
    file: UploadFile = File(...),
    provider: str = Form("auto"),
    api_key: Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
    custom_focus: Optional[str] = Form(None)
):
    try:
        content_bytes = await file.read()
        filename = file.filename or "contract.pdf"

        if filename.lower().endswith(".pdf"):
            doc = DocumentParser.parse_pdf_bytes(content_bytes, filename=filename)
        else:
            text = content_bytes.decode("utf-8", errors="ignore")
            doc = DocumentParser.parse_text(text, filename=filename)

        report = LegalDocumentAnalyzer.review_document(
            doc=doc,
            provider=provider,
            api_key=api_key,
            model_name=model_name,
            custom_focus=custom_focus
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract analysis failed: {str(e)}")


@app.post("/api/analyze-sample", response_model=ReviewReport)
async def analyze_sample(req: AnalyzeSampleRequest):
    file_path = os.path.join(SAMPLE_DIR, req.sample_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Sample contract '{req.sample_id}' not found")

    try:
        doc = DocumentParser.parse_pdf_file(file_path)
        report = LegalDocumentAnalyzer.review_document(
            doc=doc,
            provider=req.provider or "auto",
            api_key=req.api_key,
            model_name=req.model_name,
            custom_focus=req.custom_focus
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample analysis failed: {str(e)}")


@app.post("/api/analyze-text", response_model=ReviewReport)
async def analyze_text(req: AnalyzeTextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        doc = DocumentParser.parse_text(req.text, filename=req.filename or "Custom_Contract.txt")
        report = LegalDocumentAnalyzer.review_document(
            doc=doc,
            provider=req.provider or "auto",
            api_key=req.api_key,
            model_name=req.model_name,
            custom_focus=req.custom_focus
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    print(f"Starting AI Legal Document Reviewer at http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
