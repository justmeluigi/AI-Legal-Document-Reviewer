from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class GroundedCitation(BaseModel):
    page: int = Field(..., description="1-indexed page number where the passage appears.")
    passage: str = Field(..., description="Exact verbatim text excerpt from the document supporting this finding.")
    verified: bool = Field(default=True, description="Whether the passage was successfully verified against the document text.")


class ExtractedClause(BaseModel):
    category: str = Field(..., description="Legal category, e.g., Indemnification, Limitation of Liability, Termination, Confidentiality, Intellectual Property, Payment, Non-Compete, Dispute Resolution.")
    title: str = Field(..., description="Brief title or section name of the clause.")
    obligated_party: str = Field(..., description="Which party bears the obligation (e.g., 'Vendor', 'Client / Customer', 'Mutual', 'Disclosing Party').")
    summary: str = Field(..., description="Concise explanation of the obligation and its legal effect.")
    citation: GroundedCitation = Field(..., description="Verbatim cited passage and page number.")


class RiskFinding(BaseModel):
    title: str = Field(..., description="Short title of the identified risk.")
    severity: Literal["HIGH", "MEDIUM", "LOW"] = Field(..., description="Risk severity level.")
    category: str = Field(..., description="Clause category associated with this risk.")
    explanation: str = Field(..., description="Explanation of why this clause is dangerous, one-sided, or commercially unfavorable.")
    recommendation: str = Field(..., description="Suggested redline revision or negotiation strategy to mitigate the risk.")
    citation: GroundedCitation = Field(..., description="Verbatim quote from the contract demonstrating the risky language.")


class MissingClause(BaseModel):
    clause_name: str = Field(..., description="Name of the missing or deficient clause (e.g., 'Mutual Indemnification Cap', 'Data Protection / GDPR Addendum', 'Termination for Convenience').")
    importance: Literal["CRITICAL", "RECOMMENDED", "OPTIONAL"] = Field(..., description="Level of importance.")
    explanation: str = Field(..., description="Why this standard legal protection is absent and what exposure it creates.")
    suggested_language: str = Field(..., description="Model clause language that should be inserted.")


class ExecutiveSummary(BaseModel):
    contract_title: str = Field(..., description="Identified title or nature of the agreement.")
    parties: List[str] = Field(default_factory=list, description="Names of the contracting parties identified in the document.")
    effective_date: Optional[str] = Field(default="Not specified", description="Effective date or execution date.")
    term_and_termination: Optional[str] = Field(default="Not specified", description="Duration, renewal terms, and general termination provisions.")
    governing_law: Optional[str] = Field(default="Not specified", description="Governing law and jurisdiction.")
    payment_terms: Optional[str] = Field(default="Not specified", description="Pricing, invoicing, and payment structure.")
    high_level_summary: str = Field(..., description="2-4 sentence executive overview of the agreement purpose and structure.")
    key_takeaways: List[str] = Field(default_factory=list, description="3-5 critical business and legal takeaways.")


class ReviewReport(BaseModel):
    filename: str = Field(..., description="Original filename or document identifier.")
    total_pages: int = Field(..., description="Total pages processed.")
    overall_risk_score: int = Field(..., ge=0, le=100, description="Overall risk score from 0 (very safe) to 100 (critically risky).")
    risk_level: Literal["LOW RISK", "MODERATE RISK", "HIGH RISK", "CRITICAL RISK"] = Field(..., description="Summary risk classification.")
    executive_summary: ExecutiveSummary = Field(..., description="High-level terms and party breakdown.")
    clauses: List[ExtractedClause] = Field(default_factory=list, description="Extracted key clauses and obligations.")
    risks: List[RiskFinding] = Field(default_factory=list, description="Identified risky or one-sided provisions.")
    missing_clauses: List[MissingClause] = Field(default_factory=list, description="Essential missing legal protections.")
    provider_used: str = Field(default="auto", description="LLM provider and model used for analysis.")
    processing_time_seconds: float = Field(default=0.0, description="Processing duration in seconds.")
