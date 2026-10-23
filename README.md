# AI Legal Document Reviewer & Grounded Clause Intelligence (Legal AI)

An enterprise-grade, grounded contract review application built with **Python**, **PyMuPDF**, **LangChain**, and **FastAPI**. It ingests commercial legal agreements (PDFs or plain text), extracts core clauses, audits high-risk provisions, identifies missing standard commercial protections, and **cites verbatim source passages with exact page anchors** for complete hallucination-free verification.

---

## 🌟 Key Features

1. **Multi-Page PDF Ingestion & Grounding (PyMuPDF)**
   - Extracts page-by-page structured text, preserving page numbering, paragraphs, and exact character offsets.
   - Verifies all model citations against genuine document spans so every redline is grounded in verbatim text.

2. **Clause & Obligation Extraction**
   - Automatically categorizes key provisions: *Indemnification, Limitation of Liability, Term & Renewal, Intellectual Property, Confidentiality, Payment Terms, Non-Compete, Governing Law*.
   - Identifies which party bears the legal obligation (*Vendor, Customer, Mutual*).

3. **Risk & Red-Flag Audit**
   - Detects dangerous or one-sided commercial terms (e.g. unilateral uncapped indemnity, $100 liability caps vs. unlimited customer liability, 36-month automatic renewals).
   - Classifies risk severity (**HIGH**, **MEDIUM**, **LOW**) and generates actionable **counter-proposals and redlines**.

4. **Missing Standard Clause Detection**
   - Audits whether standard commercial protections are absent (e.g., Data Protection / GDPR Addendum, SLA uptime guarantees, Force Majeure).
   - Generates suggested model language ready for contract insertion.

5. **Grounded Document Citations & Page Anchors**
   - Every risk finding and extracted clause links to the exact verbatim document passage and page number.
   - Interactive Citation Inspector modal provides instant auditability.

6. **Local Qwen 3.5 2B & Multi-LLM Support**
   - **Local Inference with Qwen 3.5 2B**: Powered locally via Ollama with 100% data privacy (no document leaves your machine, no external API keys required).
   - Also supports **Google Gemini** (`gemini-2.5-flash`), **OpenAI** (`gpt-4o-mini`), **Groq** (`llama-3.3-70b`), and an intelligent zero-config rule fallback.

7. **Modern Web Interface & REST API**
   - Fast, interactive single-page application served directly by FastAPI.
   - Includes 1-click test buttons for bundled sample contracts, severity filtering, and JSON/Markdown export.

---

## 🏗️ Architecture

```
AI Legal Document Reviewer/
├── core/
│   ├── document_parser.py      # PyMuPDF text & page extraction, passage locator & grounding
│   ├── schemas.py              # Pydantic models for structured legal review reports
│   ├── prompts.py              # LangChain prompt templates for grounded contract analysis
│   ├── llm_provider.py         # Multi-provider LLM adapter (Gemini, OpenAI, Groq, Heuristic)
│   └── analyzer.py             # Review orchestrator and citation verification engine
├── sample_contracts/
│   ├── generate_samples.py     # ReportLab script generating realistic legal contracts
│   ├── sample_saas_vendor_biased.pdf      # Critical risk sample (uncapped indemnity, auto-renew)
│   ├── sample_consulting_agreement.pdf   # High risk sample (2-yr worldwide non-compete)
│   └── sample_mutual_nda.pdf             # Low risk standard bilateral NDA
├── static/
│   ├── index.html              # Modern legal-tech web dashboard
│   ├── style.css               # Professional styling, badges, and responsive layout
│   └── app.js                  # Frontend logic: upload, sample loading, filters, modal citations
├── main.py                     # FastAPI application serving REST endpoints & static UI
├── test_reviewer.py            # Unit tests for PyMuPDF parser and analyzer
├── test_api.py                 # Integration tests for FastAPI endpoints
├── test_all_samples.py         # Comprehensive verification across all sample contracts
├── requirements.txt            # Python dependencies
├── .env.example                # Template for LLM API keys
└── README.md                   # Complete documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.11)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. (Optional) Configure LLM API Keys
Copy `.env.example` to `.env` and add your preferred provider key:
```ini
LLM_PROVIDER=auto

# Optional (if using Google Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (if using OpenAI)
OPENAI_API_KEY=your_openai_api_key_here

# Optional (if using Groq)
GROQ_API_KEY=your_groq_api_key_here
```
> *Note: If no API key is provided, the application automatically uses the built-in offline NLP engine so you can test all features and sample contracts immediately.*

### 4. Run the Application
```bash
python main.py
```
Open your browser at:
👉 **`http://127.0.0.1:8000`**

---

## 🧪 Testing the Application

Run the automated test suite:
```bash
python -m pytest -v
```

All 7 tests verify:
- Accurate PDF parsing with PyMuPDF
- Exact passage location and page identification
- Multi-contract risk scoring
- REST API health, sample contract ingestion, and text analysis

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the interactive web interface |
| `GET` | `/api/health` | Service health and active LLM provider status |
| `GET` | `/api/sample-contracts` | List bundled sample contracts with risk profiles |
| `GET` | `/api/sample-contracts/{id}/download` | Download sample PDF contract |
| `POST` | `/api/analyze-file` | Upload PDF or text file for legal review |
| `POST` | `/api/analyze-sample` | 1-Click analysis of a bundled sample contract |
| `POST` | `/api/analyze-text` | Direct analysis of raw contract text |

---

## 📑 Included Sample Contracts

The project includes 3 realistic sample agreements in `sample_contracts/`:
1. **`sample_saas_vendor_biased.pdf` (Critical Risk - 98/100)**:
   - Unilateral uncapped Customer indemnification (Vendor disclaims all indemnity).
   - Extreme liability disparity: Vendor liability capped at \$100, while Customer liability is unlimited.
   - Aggressive 36-month automatic renewal with 180-day opt-out window.
   - Irrevocable license granting Vendor the right to harvest Customer data for AI training.
   - Missing DPA (GDPR/Security) and SLA availability commitments.

2. **`sample_consulting_agreement.pdf` (High Risk - 60/100)**:
   - Overbroad 2-year worldwide non-compete covenant.
   - Broad work-made-for-hire assignment capturing background tools.
   - Right to audit personal devices without notice.

3. **`sample_mutual_nda.pdf` (Low Risk - 26/100)**:
   - Balanced bilateral confidentiality terms with standard 5 carve-outs.
   - Standard 3-year survival term and mutual obligations.

---

## 💡 Achievements Demonstrated
- **Natural Language Processing (NLP)**: Information extraction, party attribution, semantic classification, and risk severity ranking.
- **Document Processing**: Page-level extraction and token management using PyMuPDF.
- **Prompt Engineering**: Structured Pydantic outputs with strict legal reasoning, counter-proposal synthesis, and JSON schema enforcement.
- **Grounded AI Analysis**: Verbatim citation cross-referencing preventing hallucination and enabling audited legal workflows.
