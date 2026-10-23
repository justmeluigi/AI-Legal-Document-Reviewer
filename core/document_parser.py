import pymupdf as fitz
import re
import difflib
from typing import List, Dict, Any, Optional, Tuple


class DocumentPage:
    def __init__(self, page_num: int, text: str):
        self.page_num = page_num
        self.text = text
        self.clean_text = self._clean(text)

    @staticmethod
    def _clean(t: str) -> str:
        # Normalize whitespace while preserving essential structure
        return re.sub(r"\s+", " ", t).strip()


class ParsedDocument:
    def __init__(self, filename: str, pages: List[DocumentPage]):
        self.filename = filename
        self.pages = pages
        self.total_pages = len(pages)

    @property
    def full_text_with_page_markers(self) -> str:
        """Constructs full text annotated with clear page markers for the LLM."""
        chunks = []
        for p in self.pages:
            chunks.append(f"=== PAGE {p.page_num} ===\n{p.text}\n=== END PAGE {p.page_num} ===")
        return "\n\n".join(chunks)

    @property
    def plain_text(self) -> str:
        return "\n\n".join(p.text for p in self.pages)

    def locate_passage(self, passage: str) -> Tuple[Optional[int], bool]:
        """
        Locates a quoted passage in the document.
        Returns:
            (page_number, is_verified)
        """
        if not passage or not passage.strip():
            return (None, False)

        clean_passage = re.sub(r"\s+", " ", passage).strip().lower()
        if len(clean_passage) < 10:
            # Too short for reliable single matching
            return (1 if self.pages else None, True)

        # 1. Exact substring match in clean page text
        for p in self.pages:
            if clean_passage in p.clean_text.lower():
                return (p.page_num, True)

        # 2. Key phrases match (first 60 chars or last 60 chars)
        sample_len = min(60, len(clean_passage))
        sample_start = clean_passage[:sample_len]
        sample_end = clean_passage[-sample_len:]

        for p in self.pages:
            page_clean = p.clean_text.lower()
            if sample_start in page_clean or sample_end in page_clean:
                return (p.page_num, True)

        # 3. Fuzzy ratio match across pages
        best_page = None
        best_ratio = 0.0
        for p in self.pages:
            page_clean = p.clean_text.lower()
            # If passage length is significantly smaller than page, slide a window or use SequenceMatcher
            ratio = difflib.SequenceMatcher(None, clean_passage, page_clean).quick_ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_page = p.page_num

        if best_page is not None and best_ratio > 0.4:
            return (best_page, True)

        # Fallback to page 1 if not located with certainty
        return (1 if self.pages else None, False)


class DocumentParser:
    """Extracts text and structure from contracts using PyMuPDF."""

    @classmethod
    def parse_pdf_bytes(cls, pdf_bytes: bytes, filename: str = "document.pdf") -> ParsedDocument:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages: List[DocumentPage] = []
        try:
            for i, page in enumerate(doc):
                text = page.get_text("text")
                pages.append(DocumentPage(page_num=i + 1, text=text))
        finally:
            doc.close()

        if not pages:
            pages = [DocumentPage(page_num=1, text="")]

        return ParsedDocument(filename=filename, pages=pages)

    @classmethod
    def parse_pdf_file(cls, file_path: str) -> ParsedDocument:
        with open(file_path, "rb") as f:
            data = f.read()
        return cls.parse_pdf_bytes(data, filename=file_path)

    @classmethod
    def parse_text(cls, text: str, filename: str = "document.txt") -> ParsedDocument:
        """Parses plain text, simulating page splits every ~3000 characters if no pages exist."""
        # Check if text already contains page markers
        pattern = r"=== PAGE (\d+) ==="
        matches = list(re.finditer(pattern, text))

        if matches:
            pages: List[DocumentPage] = []
            for i in range(len(matches)):
                start = matches[i].end()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                page_num = int(matches[i].group(1))
                page_text = text[start:end].replace(f"=== END PAGE {page_num} ===", "").strip()
                pages.append(DocumentPage(page_num=page_num, text=page_text))
            return ParsedDocument(filename=filename, pages=pages)

        # Split text into ~3000 character logical pages
        chunk_size = 3000
        paragraphs = text.split("\n\n")
        pages: List[DocumentPage] = []
        current_chunk = []
        current_len = 0
        current_page_num = 1

        for para in paragraphs:
            current_chunk.append(para)
            current_len += len(para)
            if current_len >= chunk_size:
                pages.append(DocumentPage(page_num=current_page_num, text="\n\n".join(current_chunk)))
                current_chunk = []
                current_len = 0
                current_page_num += 1

        if current_chunk or not pages:
            pages.append(DocumentPage(page_num=current_page_num, text="\n\n".join(current_chunk)))

        return ParsedDocument(filename=filename, pages=pages)
