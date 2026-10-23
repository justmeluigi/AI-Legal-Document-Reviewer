import time
import json
import re
from typing import Optional, Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
from core.schemas import ReviewReport, GroundedCitation
from core.document_parser import ParsedDocument
from core.prompts import SYSTEM_PROMPT, ANALYSIS_PROMPT_TEMPLATE
from core.llm_provider import get_llm, OfflineHeuristicAnalyzer


class LegalDocumentAnalyzer:
    """Orchestrates document parsing, LLM review, grounded citation verification, and scoring."""

    @classmethod
    def review_document(
        cls,
        doc: ParsedDocument,
        provider: str = "auto",
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        custom_focus: Optional[str] = None
    ) -> ReviewReport:
        start_time = time.time()
        provider_name = provider.lower()
        used_provider_label = "Offline Heuristic NLP Engine"

        llm = get_llm(provider=provider, api_key=api_key, model_name=model_name)
        raw_data: Optional[Dict[str, Any]] = None

        if llm is not None:
            try:
                # Prepare prompt with page markers
                prompt_text = ANALYSIS_PROMPT_TEMPLATE.format(
                    contract_text=doc.full_text_with_page_markers,
                    custom_focus=custom_focus or "General comprehensive review with emphasis on risks and missing terms."
                )

                messages = [
                    SystemMessage(content=SYSTEM_PROMPT),
                    HumanMessage(content=prompt_text)
                ]

                response = llm.invoke(messages)
                content = response.content

                # Clean markdown blocks if present
                clean_json = cls._extract_json_string(content)
                raw_data = json.loads(clean_json)
                used_provider_label = f"{provider.capitalize()} LLM ({getattr(llm, 'model_name', getattr(llm, 'model', 'default'))})"

            except Exception as e:
                print(f"[WARN] LLM call failed ({e}). Falling back to Offline Heuristic Engine.")
                raw_data = None

        # Fallback to offline engine if LLM wasn't initialized or failed
        if raw_data is None:
            raw_data = OfflineHeuristicAnalyzer.analyze(doc, custom_focus=custom_focus)
            used_provider_label = "Offline Heuristic NLP Engine (Zero-Configuration Fallback)"

        # Grounded Citation Verification & Page Alignment
        cls._verify_grounded_citations(doc, raw_data)

        # Assemble full Report model
        elapsed = round(time.time() - start_time, 2)
        raw_data["filename"] = doc.filename
        raw_data["total_pages"] = doc.total_pages
        raw_data["provider_used"] = used_provider_label
        raw_data["processing_time_seconds"] = elapsed

        report = ReviewReport.model_validate(raw_data)
        return report

    @staticmethod
    def _extract_json_string(text: str) -> str:
        text = text.strip()
        # Remove markdown code blocks if wrapped
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        # Find first '{' and last '}'
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return text[start:end+1]
        return text

    @classmethod
    def _verify_grounded_citations(cls, doc: ParsedDocument, data: Dict[str, Any]):
        """Verifies and grounds every cited passage directly against PyMuPDF page text."""
        # Verify extracted clauses
        if "clauses" in data and isinstance(data["clauses"], list):
            for clause in data["clauses"]:
                cit = clause.get("citation")
                if isinstance(cit, dict) and "passage" in cit:
                    passage = cit["passage"]
                    actual_page, is_verified = doc.locate_passage(passage)
                    if actual_page is not None:
                        cit["page"] = actual_page
                    cit["verified"] = is_verified

        # Verify risks
        if "risks" in data and isinstance(data["risks"], list):
            for risk in data["risks"]:
                cit = risk.get("citation")
                if isinstance(cit, dict) and "passage" in cit:
                    passage = cit["passage"]
                    actual_page, is_verified = doc.locate_passage(passage)
                    if actual_page is not None:
                        cit["page"] = actual_page
                    cit["verified"] = is_verified
