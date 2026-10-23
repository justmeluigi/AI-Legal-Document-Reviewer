// Legal AI • Grounded Legal Reviewer Frontend Logic
// Apple-inspired Minimalist Interaction Engine

let currentInputMode = 'upload';
let selectedFile = null;
let selectedSampleId = null;
let currentReport = null;
let sampleContracts = [];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  setupDragAndDrop();
  await checkHealthAndProviders();
  await loadSampleContractsList();
});

// Switch input modes between Upload, Samples, and Raw Text
function switchInputMode(mode) {
  currentInputMode = mode;
  document.getElementById('tabUploadBtn').classList.toggle('active', mode === 'upload');
  document.getElementById('tabSamplesBtn').classList.toggle('active', mode === 'samples');
  document.getElementById('tabTextBtn').classList.toggle('active', mode === 'text');

  document.getElementById('uploadModeView').classList.toggle('hidden', mode !== 'upload');
  document.getElementById('samplesModeView').classList.toggle('hidden', mode !== 'samples');
  document.getElementById('textModeView').classList.toggle('hidden', mode !== 'text');
}

// Drag & drop setup with Apple-style smooth hover reactions
function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });
}

function handleFileSelected(file) {
  selectedFile = file;
  document.getElementById('selectedFileName').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById('selectedFileInfo').classList.remove('hidden');
}

function clearSelectedFile() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('selectedFileInfo').classList.add('hidden');
}

// Health check & provider detection
async function checkHealthAndProviders() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const badge = document.getElementById('providerStatusBadge');

    if (data.configured_providers.qwen) {
      badge.textContent = 'Qwen 3.5 2B Local Active';
    } else if (data.configured_providers.gemini) {
      badge.textContent = 'Gemini 2.5 Active';
    } else if (data.configured_providers.openai) {
      badge.textContent = 'OpenAI Active';
    } else if (data.configured_providers.groq) {
      badge.textContent = 'Groq Llama 3.3 Active';
    } else {
      badge.textContent = 'Offline Engine Ready';
    }

    onProviderChange();
  } catch (err) {
    console.warn('Health check connection note:', err);
  }
}

// Load sample contracts from API
async function loadSampleContractsList() {
  try {
    const res = await fetch('/api/sample-contracts');
    const data = await res.json();
    sampleContracts = data.samples || [];

    const list = document.getElementById('sampleContractsList');
    list.innerHTML = '';

    sampleContracts.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `sample-item ${idx === 0 ? 'selected' : ''}`;
      if (idx === 0) selectedSampleId = s.id;

      let tagClass = 'tag-high';
      if (s.expected_risk.includes('CRITICAL')) tagClass = 'tag-crit';
      if (s.expected_risk.includes('LOW')) tagClass = 'tag-low';

      item.innerHTML = `
        <div class="sample-name">${s.name}</div>
        <div class="sample-desc">${s.description}</div>
        <span class="sample-tag ${tagClass}">${s.expected_risk}</span>
      `;

      item.onclick = () => {
        document.querySelectorAll('.sample-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedSampleId = s.id;
      };

      list.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load sample contracts:', err);
  }
}

function onProviderChange() {
  const provider = document.getElementById('providerSelect').value;
  const keyGroup = document.getElementById('apiKeyGroup');
  // Local Qwen and Mock operate with 100% zero external keys
  keyGroup.style.display = (provider === 'mock' || provider === 'qwen') ? 'none' : 'block';
}

// 1-Click test from starter deck
function loadSample(sampleId) {
  switchInputMode('samples');
  selectedSampleId = sampleId;
  const items = document.querySelectorAll('.sample-item');
  items.forEach(item => {
    if (item.innerHTML.includes(sampleId) || (sampleId.includes('saas') && item.innerHTML.includes('CloudScale'))) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  executeReview();
}

// Review execution orchestrator
async function executeReview() {
  const provider = document.getElementById('providerSelect').value;
  const apiKey = document.getElementById('apiKeyInput').value.trim() || null;
  const customFocus = document.getElementById('customFocusInput').value.trim() || null;

  const btn = document.getElementById('runReviewBtn');
  const spinner = document.getElementById('reviewSpinner');
  const btnText = btn.querySelector('.cta-label');

  btn.disabled = true;
  spinner.classList.remove('hidden');
  btnText.textContent = 'Reviewing Document...';

  try {
    let reportData = null;

    if (currentInputMode === 'upload') {
      if (!selectedFile) {
        alert('Please select or drag-and-drop a contract PDF first.');
        return;
      }
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('provider', provider);
      if (apiKey) formData.append('api_key', apiKey);
      if (customFocus) formData.append('custom_focus', customFocus);

      const res = await fetch('/api/analyze-file', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to review document');
      reportData = await res.json();

    } else if (currentInputMode === 'samples') {
      if (!selectedSampleId) selectedSampleId = sampleContracts[0]?.id;
      const res = await fetch('/api/analyze-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sample_id: selectedSampleId,
          provider: provider,
          api_key: apiKey,
          custom_focus: customFocus
        })
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to review sample');
      reportData = await res.json();

    } else if (currentInputMode === 'text') {
      const text = document.getElementById('contractTextInput').value.trim();
      if (!text) {
        alert('Please paste contract clauses into the text area.');
        return;
      }
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          provider: provider,
          api_key: apiKey,
          custom_focus: customFocus
        })
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to review contract text');
      reportData = await res.json();
    }

    if (reportData) {
      currentReport = reportData;
      renderReport(reportData);
    }
  } catch (err) {
    alert(`Review Error: ${err.message}`);
    console.error(err);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Run Legal Review';
  }
}

// Render Review Report to Apple-Inspired Dashboard
function renderReport(report) {
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('resultsDashboard').classList.remove('hidden');

  // Top KPI Metrics
  const score = report.overall_risk_score;
  const scoreEl = document.getElementById('riskScoreVal');
  const badgeEl = document.getElementById('riskBadgeLevel');
  const kpiCard = document.getElementById('riskKpiCard');

  scoreEl.textContent = score;
  badgeEl.textContent = report.risk_level;

  if (score >= 75) {
    scoreEl.style.color = 'var(--risk-crit)';
    badgeEl.className = 'risk-status-pill pill-high';
    kpiCard.style.borderLeftColor = 'var(--risk-crit)';
  } else if (score >= 45) {
    scoreEl.style.color = 'var(--risk-med)';
    badgeEl.className = 'risk-status-pill pill-medium';
    kpiCard.style.borderLeftColor = 'var(--risk-med)';
  } else {
    scoreEl.style.color = 'var(--risk-low)';
    badgeEl.className = 'risk-status-pill pill-low';
    kpiCard.style.borderLeftColor = 'var(--risk-low)';
  }

  document.getElementById('metricPages').textContent = report.total_pages;
  document.getElementById('metricFilename').textContent = report.filename;
  document.getElementById('metricRisks').textContent = report.risks.length;
  
  const highRisksCount = report.risks.filter(r => r.severity === 'HIGH').length;
  document.getElementById('metricHighRisks').textContent = `${highRisksCount} Critical / High`;

  document.getElementById('metricMissing').textContent = report.missing_clauses.length;
  document.getElementById('metricClauses').textContent = report.clauses.length;

  // Subnav counters
  document.getElementById('tabRiskCount').textContent = report.risks.length;
  document.getElementById('tabClauseCount').textContent = report.clauses.length;
  document.getElementById('tabMissingCount').textContent = report.missing_clauses.length;

  // TAB 1: Executive Summary
  const exec = report.executive_summary;
  document.getElementById('execDocTitle').textContent = exec.contract_title || 'Commercial Agreement';
  document.getElementById('execHighLevel').textContent = exec.high_level_summary || '';
  document.getElementById('execParties').textContent = exec.parties.join(' • ') || 'Unspecified';
  document.getElementById('execEffectiveDate').textContent = exec.effective_date || 'N/A';
  document.getElementById('execGoverningLaw').textContent = exec.governing_law || 'N/A';
  document.getElementById('execTerm').textContent = exec.term_and_termination || 'N/A';
  document.getElementById('execPayment').textContent = exec.payment_terms || 'N/A';
  document.getElementById('summaryModelTag').textContent = report.provider_used || 'Grounded Analysis';

  const takeawaysList = document.getElementById('execTakeawaysList');
  takeawaysList.innerHTML = '';
  (exec.key_takeaways || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    takeawaysList.appendChild(li);
  });

  // TAB 2: Red-Flag Risks
  renderRiskCards(report.risks);

  // TAB 3: Clause Inventory
  populateClauseCategoryDropdown(report.clauses);
  renderClauseCards(report.clauses);

  // TAB 4: Missing Protections
  renderMissingCards(report.missing_clauses);

  // Default to Summary Tab
  switchResultTab('summary');
}

// Render Risk Redline Cards
function renderRiskCards(risks) {
  const container = document.getElementById('riskCardsContainer');
  container.innerHTML = '';

  if (risks.length === 0) {
    container.innerHTML = '<div class="apple-card" style="text-align: center; color: var(--text-tertiary); padding: 3rem;">No critical risks detected in this agreement.</div>';
    return;
  }

  risks.forEach((r, idx) => {
    const card = document.createElement('div');
    const sevClass = r.severity.toLowerCase();
    card.className = `risk-entry ${sevClass}`;

    card.innerHTML = `
      <div class="risk-headline-row">
        <div>
          <div class="risk-subject">${r.title}</div>
          <span class="risk-category-tag">${r.category}</span>
        </div>
        <span class="risk-badge-pill pill-${sevClass}">${r.severity} EXPOSURE</span>
      </div>

      <div class="risk-body-text">${r.explanation}</div>

      <div class="redline-box">
        <strong>Negotiation Counter-Proposal / Redline:</strong> ${r.recommendation}
      </div>

      <div class="passage-preview-chip" onclick="openCitationModal(${idx}, 'risk')">
        <div class="preview-meta-row">
          <span class="preview-page-pill">Page ${r.citation.page}</span>
          <span class="preview-inspect-cue">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Inspect Source Passage
          </span>
        </div>
        <div class="preview-quote-line">“${escapeHtml(r.citation.passage)}”</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Severity Filtering
function filterRisks(severity) {
  document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  if (!currentReport) return;
  if (severity === 'ALL') {
    renderRiskCards(currentReport.risks);
  } else {
    const filtered = currentReport.risks.filter(r => r.severity === severity);
    renderRiskCards(filtered);
  }
}

// Clause Inventory Dropdown & Cards
function populateClauseCategoryDropdown(clauses) {
  const select = document.getElementById('clauseCategoryFilter');
  select.innerHTML = '<option value="ALL">All Categories</option>';
  const categories = [...new Set(clauses.map(c => c.category))];
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderClauseCards(clauses) {
  const container = document.getElementById('clausesContainer');
  container.innerHTML = '';

  if (clauses.length === 0) {
    container.innerHTML = '<div class="apple-card" style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary);">No clauses match this category filter.</div>';
    return;
  }

  clauses.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'clause-tile';

    card.innerHTML = `
      <div class="clause-tile-header">
        <span class="clause-category-name">${c.category}</span>
        <span class="clause-party-pill">${c.obligated_party}</span>
      </div>
      <h4>${c.title}</h4>
      <div class="clause-summary-text">${c.summary}</div>

      <div class="passage-preview-chip" onclick="openCitationModal(${idx}, 'clause')">
        <div class="preview-meta-row">
          <span class="preview-page-pill">Page ${c.citation.page}</span>
          <span class="preview-inspect-cue">Citation 🔍</span>
        </div>
        <div class="preview-quote-line">“${escapeHtml(c.citation.passage)}”</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterClauses(category) {
  if (!currentReport) return;
  if (category === 'ALL') {
    renderClauseCards(currentReport.clauses);
  } else {
    const filtered = currentReport.clauses.filter(c => c.category === category);
    renderClauseCards(filtered);
  }
}

// Render Missing Clauses Deck
function renderMissingCards(missingClauses) {
  const container = document.getElementById('missingCardsContainer');
  container.innerHTML = '';

  if (missingClauses.length === 0) {
    container.innerHTML = '<div class="apple-card" style="text-align: center; color: var(--text-tertiary); padding: 3rem;">All standard commercial protections are present.</div>';
    return;
  }

  missingClauses.forEach(m => {
    const card = document.createElement('div');
    card.className = 'missing-entry';
    const isCrit = m.importance === 'CRITICAL';
    const impClass = isCrit ? 'imp-critical' : 'imp-recommended';

    card.innerHTML = `
      <div class="missing-top">
        <h4>${m.clause_name}</h4>
        <span class="importance-badge ${impClass}">${m.importance} PROTECTIVE TERM</span>
      </div>
      <div class="missing-detail">${m.explanation}</div>
      <div class="model-language-card">
        <div class="model-label">Suggested Model Contract Clause:</div>
        <div class="model-snippet">"${escapeHtml(m.suggested_language)}"</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Subnav Tab Switching
function switchResultTab(tabId) {
  const tabs = ['summary', 'risks', 'clauses', 'missing'];
  tabs.forEach(t => {
    const btn = document.querySelector(`.subnav-btn[onclick*="${t}"]`);
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tabId);
    if (content) content.classList.toggle('hidden', t !== tabId);
  });
}

// Citation Inspector Modal Sheet
function openCitationModal(index, type) {
  if (!currentReport) return;

  const item = (type === 'risk') ? currentReport.risks[index] : currentReport.clauses[index];
  if (!item) return;

  document.getElementById('modalTitle').textContent = item.title;
  document.getElementById('modalPageBadge').textContent = `Document Page ${item.citation.page}`;
  document.getElementById('modalPassageText').textContent = item.citation.passage;
  document.getElementById('modalContextText').textContent = (type === 'risk') ? item.explanation : item.summary;

  document.getElementById('citationModal').classList.remove('hidden');
}

function closeCitationModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('sheet-close-btn')) return;
  document.getElementById('citationModal').classList.add('hidden');
}

// Clean Export Functions
function exportJSONReport() {
  if (!currentReport) return;
  const jsonStr = JSON.stringify(currentReport, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Legal_AI_Audit_${currentReport.filename.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  a.click();
}

function exportMarkdownReport() {
  if (!currentReport) return;
  const r = currentReport;
  const exec = r.executive_summary;

  let md = `# Legal Document Review Report: ${r.filename}\n\n`;
  md += `**Overall Risk Level:** ${r.risk_level} (${r.overall_risk_score}/100)\n`;
  md += `**Total Pages:** ${r.total_pages} | **Provider Used:** ${r.provider_used}\n\n`;
  md += `## 1. Executive Summary\n`;
  md += `- **Parties:** ${exec.parties.join(', ')}\n`;
  md += `- **Effective Date:** ${exec.effective_date}\n`;
  md += `- **Governing Law:** ${exec.governing_law}\n`;
  md += `- **Term & Termination:** ${exec.term_and_termination}\n`;
  md += `- **Financial / Payment Terms:** ${exec.payment_terms}\n\n`;
  md += `### Synopsis\n${exec.high_level_summary}\n\n`;

  md += `## 2. Identified Risks & Red Flags\n`;
  r.risks.forEach((rk, i) => {
    md += `### ${i+1}. [${rk.severity}] ${rk.title} (${rk.category})\n`;
    md += `- **Explanation:** ${rk.explanation}\n`;
    md += `- **Counter-Proposal:** ${rk.recommendation}\n`;
    md += `- **Verbatim Passage (Page ${rk.citation.page}):** \n> "${rk.citation.passage}"\n\n`;
  });

  md += `## 3. Missing Legal Protections\n`;
  r.missing_clauses.forEach((m, i) => {
    md += `### ${i+1}. [${m.importance}] ${m.clause_name}\n`;
    md += `- **Exposure:** ${m.explanation}\n`;
    md += `- **Suggested Model Clause:** \n> "${m.suggested_language}"\n\n`;
  });

  md += `## 4. Key Clauses & Obligations\n`;
  r.clauses.forEach((c, i) => {
    md += `### ${i+1}. ${c.title} (${c.category}) - ${c.obligated_party}\n`;
    md += `- **Summary:** ${c.summary}\n`;
    md += `- **Verbatim Passage (Page ${c.citation.page}):** \n> "${c.citation.passage}"\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Legal_AI_Audit_${r.filename.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
  a.click();
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
