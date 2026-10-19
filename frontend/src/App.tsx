import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, Bot, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, Command, FileCheck2, FileText,
  HardDrive, LayoutDashboard, LoaderCircle, Menu, MessageSquareText, Plus, RefreshCw, Search,
  ShieldCheck, Sparkles, Wrench, Workflow, X, Zap, AlertTriangle,
} from 'lucide-react';
import { api, inspectMcp, type CaseEvent, type Dashboard, type Device, type Evidence, type Investigation, type RepairCase } from './lib/api';

type Page = 'Overview' | 'Devices' | 'Repair cases' | 'MCP lab';
type DeviceForm = { name: string; brand: string; category: string; model: string; serialNumber: string; purchaseDate: string; warrantyMonths: number; room: string; condition: string; referenceTitle: string; referenceSection: string; referenceExcerpt: string; referenceUrl: string };
const pages: Array<{ label: Page; icon: typeof LayoutDashboard; hint: string }> = [
  { label: 'Overview', icon: LayoutDashboard, hint: 'Workspace' },
  { label: 'Devices', icon: HardDrive, hint: 'Inventory' },
  { label: 'Repair cases', icon: FileCheck2, hint: 'Case history' },
  { label: 'MCP lab', icon: Workflow, hint: 'Developer tools' },
];

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function shortDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'FR';
}
function classNames(...values: Array<string | false | undefined | null>) { return values.filter(Boolean).join(' '); }

function Button({ children, variant = 'primary', size = 'md', className, disabled, onClick, type = 'button' }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md';
  className?: string; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit';
}) {
  return <button type={type} disabled={disabled} onClick={onClick} className={classNames('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}>{children}</button>;
}
function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={classNames('panel', className)}>{children}</section>;
}
function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p className="muted mt-1">{description}</p>}</div>{action}</div>;
}
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{children}</span>;
}
function EmptyState({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><h3>{title}</h3><p>{description}</p></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [cases, setCases] = useState<RepairCase[]>([]);
  const [aiProvider, setAiProvider] = useState<'demo' | 'bedrock'>('demo');
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deviceQuery, setDeviceQuery] = useState('PureAir 450');
  const [issue, setIssue] = useState('The unit is making a grinding noise.');
  const [sessionId] = useState(() => {
    const storageKey = 'fixrelay-session-id-v1';
    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing && /^session_[a-zA-Z0-9._:-]{8,112}$/.test(existing)) return existing;
      const created = `session_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
      window.localStorage.setItem(storageKey, created);
      return created;
    } catch {
      return `session_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    }
  });
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [agentPrompt, setAgentPrompt] = useState('Use the product evidence and explain the safest next step.');
  const [agentAnswer, setAgentAnswer] = useState('');
  const [agentProvider, setAgentProvider] = useState('');
  const [caseDetail, setCaseDetail] = useState<RepairCase | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>({ name: '', brand: '', category: 'Air purifier', model: '', serialNumber: '', purchaseDate: '2026-02-11', warrantyMonths: 24, room: 'Living room', condition: 'Needs attention', referenceTitle: '', referenceSection: '', referenceExcerpt: '', referenceUrl: '' });
  const [mcpTool, setMcpTool] = useState('search_devices');
  const [mcpArgs, setMcpArgs] = useState('{"query":"air purifier"}');
  const [mcpTools, setMcpTools] = useState<Array<{ name: string; description?: string }>>([]);
  const [mcpResult, setMcpResult] = useState('Connect to the MCP endpoint to inspect available tools and run a real call.');
  const [mcpMeta, setMcpMeta] = useState('Not connected');
  const [confirmModal, setConfirmModal] = useState<{ summary: string; deviceName: string; issue: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [health, overview, deviceData, caseData] = await Promise.all([api.health(), api.overview(), api.devices(), api.cases()]);
      setBackendOnline(health.status === 'ok');
      setAiProvider(health.aiProvider);
      setDashboard(overview);
      setDevices(deviceData.devices);
      setCases(caseData.cases);
    } catch (error) {
      setBackendOnline(false);
      setToast(error instanceof Error ? error.message : 'Unable to connect to FixRelay API.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((device) => `${device.name} ${device.brand} ${device.model} ${device.category} ${device.room}`.toLowerCase().includes(q));
  }, [devices, search]);

  async function submitInvestigation(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setAgentAnswer('');
    try {
      const result = await api.investigate({ deviceQuery: deviceQuery.trim(), issue: issue.trim(), sessionId });
      setInvestigation(result);
      setToast(result.device ? `Investigation ready for ${result.device.name}.` : 'Investigation ready; no exact inventory match was found.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Investigation failed.'); }
    finally { setWorking(false); }
  }

  async function createApprovedCase() {
    if (!investigation?.device) { setToast('Match a device before creating a case draft.'); return; }
    const device = investigation.device;
    const issueForSummary = investigation.issue.slice(0, 420);
    const summary = `${device.name}: ${issueForSummary}${investigation.issue.length > 420 ? '\u2026' : ''}. Evidence reviewed: ${investigation.evidence.length} excerpt(s). Verify official documentation and contact a qualified provider directly if needed.`;
    // Show our own styled confirmation modal instead of window.confirm()
    setConfirmModal({ summary, deviceName: device.name, issue: investigation.issue });
  }

  async function executeConfirmedCase() {
    if (!investigation?.device || !confirmModal) return;
    const device = investigation.device;
    // Capture the modal data before closing the modal so the closure is unambiguous.
    const { summary, issue: confirmedIssue } = confirmModal;
    const confirmedSessionId = investigation.sessionId;
    setConfirmModal(null);
    setWorking(true);
    try {
      const approval = await api.requestApproval({ deviceId: device.id, issue: confirmedIssue, summary, sessionId: confirmedSessionId });
      const created = await api.createCase({ deviceId: device.id, issue: confirmedIssue, summary, sessionId: confirmedSessionId, approvalToken: approval.approvalToken });
      setCaseDetail(created.case);
      await refresh();
      let historyRefreshFailed = false;
      try {
        const detail = await api.getCase(created.case.id);
        setCaseDetail(detail.case);
      } catch {
        historyRefreshFailed = true;
      }
      setToast(historyRefreshFailed
        ? `Local repair-case draft created: ${created.case.id}. Its event history could not be refreshed yet.`
        : `Local repair-case draft created: ${created.case.id}`);
      setPage('Repair cases');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Case creation failed.'); }
    finally { setWorking(false); }
  }

  async function addDevice(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      const created = await api.addDevice(deviceForm);
      setDevices((current) => [...current, created.device].sort((a, b) => a.name.localeCompare(b.name)));
      setDeviceForm({ name: '', brand: '', category: 'Air purifier', model: '', serialNumber: '', purchaseDate: '2026-02-11', warrantyMonths: 24, room: 'Living room', condition: 'Needs attention', referenceTitle: '', referenceSection: '', referenceExcerpt: '', referenceUrl: '' });
      setShowAddDevice(false);
      setToast(`Added ${created.device.name} to your local inventory.`);
      await refresh();
    } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to save device.'); }
    finally { setWorking(false); }
  }

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      const result = await api.agentChat({ prompt: agentPrompt, sessionId });
      setAgentAnswer(result.answer);
      setAgentProvider(result.provider);
      if (result.investigation) setInvestigation(result.investigation);
    } catch (error) { setToast(error instanceof Error ? error.message : 'Agent request failed.'); }
    finally { setWorking(false); }
  }

  async function runMcp(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMcpResult('Connecting to MCP endpoint…');
    try {
      const parsed = JSON.parse(mcpArgs || '{}') as Record<string, unknown>;
      const result = await inspectMcp(mcpTool, parsed);
      setMcpTools(result.tools);
      setMcpMeta(`Connected · MCP ${result.protocolVersion} · ${result.tools.length} tools discovered`);
      setMcpResult(JSON.stringify(result.result, null, 2));
    } catch (error) {
      setMcpMeta('Connection or tool call failed');
      setMcpResult(error instanceof Error ? error.message : 'Unexpected MCP error.');
    } finally { setWorking(false); }
  }

  async function openCase(id: string) {
    try { const result = await api.getCase(id); setCaseDetail(result.case); }
    catch (error) { setToast(error instanceof Error ? error.message : 'Could not load case.'); }
  }

  const navTo = (target: Page) => { setPage(target); setMobileNavOpen(false); };

  return (
    <div className="app-shell">
      {/* Approval confirmation modal — replaces window.confirm() for a professional demo experience */}
      {confirmModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-box">
            <div className="modal-icon"><AlertTriangle size={22} /></div>
            <h2 id="modal-title">Confirm repair-case draft</h2>
            <p className="modal-device"><strong>{confirmModal.deviceName}</strong></p>
            <p className="modal-issue muted">{confirmModal.issue}</p>
            <div className="modal-summary">
              <span className="modal-summary-label">Draft summary</span>
              <p>{confirmModal.summary}</p>
            </div>
            <p className="modal-note"><ShieldCheck size={13} /> This only writes to FixRelay. No provider will be contacted and no appointment will be booked.</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button onClick={() => void executeConfirmedCase()} disabled={working}>
                {working ? <LoaderCircle size={15} className="spin" /> : <FileCheck2 size={15} />} Confirm draft
              </Button>
            </div>
          </div>
        </div>
      )}
      {mobileNavOpen && <button className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <aside className={classNames('sidebar', mobileNavOpen && 'sidebar-open')}>
        <div className="brand-lockup"><div className="brand-mark"><Wrench size={20} strokeWidth={2.5} /></div><div><strong>fixrelay</strong><span>REPAIR INTELLIGENCE</span></div></div>
        <div className="workspace-switcher"><div className="workspace-avatar">FH</div><div className="workspace-copy"><strong>Family home</strong><span>Personal workspace</span></div><ChevronDown size={15} className="text-slate-400" /></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          {pages.map(({ label, icon: Icon, hint }) => <button key={label} onClick={() => navTo(label)} className={classNames('nav-item', page === label && 'nav-item-active')}><Icon size={18} /><span>{label}</span>{label === 'Repair cases' && cases.length > 0 && <span className="nav-count">{cases.length}</span>}<span className="nav-hint">{hint}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><div className="sidebar-note-icon"><ShieldCheck size={17} /></div><div><strong>Evidence first</strong><p>Source labels and safe next steps, not guesswork.</p></div></div>
          <div className="profile-row"><div className="profile-avatar">AK</div><div className="profile-copy"><strong>Home workspace</strong><span>Local demo account</span></div><button onClick={() => void refresh()} className="icon-button" aria-label="Refresh data"><RefreshCw size={16} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div>
          <div className="topbar-actions">
            <div className={classNames('connection-state', backendOnline ? 'connected' : 'disconnected')}><span className="live-dot" />{backendOnline ? 'System operational' : 'API disconnected'}</div>
            <button className="top-icon icon-button" onClick={() => void refresh()} aria-label="Refresh workspace"><RefreshCw size={17} /></button>
            <div className="top-profile">AK</div>
          </div>
        </header>

        {!backendOnline && <div className="connection-banner"><CircleAlert size={17} /><span>FixRelay API is not connected. Start PostgreSQL and the Node.js server, then refresh this page.</span><button onClick={() => void refresh()}><RefreshCw size={14} /> Retry</button></div>}

        <div className="page-content">
          {page === 'Overview' && <OverviewPage dashboard={dashboard} devices={devices} investigation={investigation} setDeviceQuery={(value) => { setDeviceQuery(value); setInvestigation(null); }} deviceQuery={deviceQuery} issue={issue} setIssue={(value) => { setIssue(value); setInvestigation(null); }} onInvestigate={submitInvestigation} onCreateCase={createApprovedCase} working={working} aiProvider={aiProvider} agentPrompt={agentPrompt} setAgentPrompt={setAgentPrompt} agentAnswer={agentAnswer} agentProvider={agentProvider} onAgent={runAgent} onNavigate={navTo} onOpenCase={openCase} />}
          {page === 'Devices' && <DevicesPage devices={filteredDevices} search={search} setSearch={setSearch} showAdd={showAddDevice} setShowAdd={setShowAddDevice} form={deviceForm} setForm={setDeviceForm} onAdd={addDevice} working={working} />}
          {page === 'Repair cases' && <CasesPage cases={cases} caseDetail={caseDetail} onOpen={openCase} onClear={() => setCaseDetail(null)} />}
          {page === 'MCP lab' && <McpPage mcpTool={mcpTool} setMcpTool={setMcpTool} mcpArgs={mcpArgs} setMcpArgs={setMcpArgs} tools={mcpTools} result={mcpResult} meta={mcpMeta} onRun={runMcp} working={working} />}
        </div>
        <footer className="app-footer"><span>FixRelay <span className="footer-separator">/</span> Evidence-grounded home repair agent</span><span className="footer-demo"><span /> Synthetic demo workspace · No external actions</span></footer>
      </main>
      {toast && <div role="status" className="toast"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
      {loading && <div className="loading-chip"><LoaderCircle size={15} className="spin" /> Syncing workspace</div>}
    </div>
  );
}

function OverviewPage(props: {
  dashboard: Dashboard | null; devices: Device[]; investigation: Investigation | null;
  setDeviceQuery: (value: string) => void; deviceQuery: string; issue: string; setIssue: (value: string) => void;
  onInvestigate: (event: FormEvent) => void; onCreateCase: () => void; working: boolean; aiProvider: string;
  agentPrompt: string; setAgentPrompt: (value: string) => void; agentAnswer: string; agentProvider: string;
  onAgent: (event: FormEvent) => void; onNavigate: (page: Page) => void; onOpenCase: (id: string) => void;
}) {
  const { dashboard, devices, investigation } = props;
  const stats = [
    { label: 'Tracked devices', value: dashboard?.devices ?? '—', note: 'Across your inventory', icon: HardDrive, iconClass: 'icon-blue', trend: 'Inventory' },
    { label: 'Open repair cases', value: dashboard?.openCases ?? '—', note: 'Drafts and active work', icon: FileCheck2, iconClass: 'icon-violet', trend: 'Cases' },
    { label: 'Priority issues', value: dashboard?.highPriority ?? '—', note: 'High or urgent cases', icon: Activity, iconClass: 'icon-orange', trend: 'Attention' },
    { label: 'Date-window warranties', value: dashboard?.activeWarranty ?? '—', note: 'Based on saved purchase dates', icon: BadgeCheck, iconClass: 'icon-green', trend: 'Calculated' },
  ];
  return <>
    <div className="welcome-row"><div><p className="eyebrow"><Sparkles size={13} /> YOUR HOME, BETTER SUPPORTED</p><h1>Make every repair decision<br className="desktop-break" /> <span>with evidence.</span></h1><p className="welcome-subtitle">One thoughtful workflow from the first symptom to a clearer, safer next step.</p></div><div className="welcome-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-core"><Wrench size={36} /></div><span className="art-chip chip-top"><ShieldCheck size={14} /> Evidence-led</span><span className="art-chip chip-bottom"><Zap size={14} /> Action-ready</span></div></div>

    <div className="stat-grid">{stats.map(({ label, value, note, icon: Icon, iconClass, trend }) => <Panel key={label} className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${iconClass}`}><Icon size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-bottom"><span>{note}</span><span className="stat-trend">{trend}</span></div></Panel>)}</div>

    <div className="content-grid">
      <div className="content-main">
        <Panel className="investigation-panel">
          <div className="panel-heading"><div><span className="step-kicker"><span>01</span> START AN INVESTIGATION</span><h2>What needs attention?</h2><p className="muted">Describe the device and what changed. FixRelay will show matching evidence and next steps.</p></div><div className="heading-illustration"><MessageSquareText size={24} /></div></div>
          <form onSubmit={props.onInvestigate} className="investigation-form">
            <label className="field-label" htmlFor="device-query">Device or model <span>Optional if mentioned in the issue</span></label>
            <div className="input-with-icon"><Search size={17} /><input id="device-query" value={props.deviceQuery} onChange={(e) => props.setDeviceQuery(e.target.value)} placeholder="e.g. PureAir 450" maxLength={160} /></div>
            <label className="field-label" htmlFor="device-issue">Describe the problem</label>
            <textarea id="device-issue" value={props.issue} onChange={(e) => props.setIssue(e.target.value)} placeholder="What happened? Include any warning lights, sounds, or changes." rows={3} minLength={4} maxLength={1200} required />
            <div className="form-footer"><span className="helper-text"><ShieldCheck size={14} /> Evidence retrieval · safety-first guidance · warranty date check</span><Button type="submit" disabled={props.working}>{props.working ? <><LoaderCircle size={16} className="spin" /> Investigating</> : <>Investigate issue <ArrowRight size={16} /></>}</Button></div>
          </form>
        </Panel>

        {investigation && <InvestigationPanel result={investigation} onCreateCase={props.onCreateCase} working={props.working} />}

        <Panel className="assistant-panel">
          <div className="assistant-head"><span className="assistant-icon"><Bot size={19} /></span><div><h3>Ask the FixRelay agent</h3><p className="muted">{props.aiProvider === 'bedrock' ? 'Live Bedrock + Strands provider configured' : 'Deterministic demo mode · no model API call'}</p></div><StatusPill tone={props.aiProvider === 'bedrock' ? 'green' : 'blue'}>{props.aiProvider === 'bedrock' ? 'Bedrock' : 'Demo mode'}</StatusPill></div>
          <form onSubmit={props.onAgent} className="agent-form"><textarea value={props.agentPrompt} onChange={(e) => props.setAgentPrompt(e.target.value)} rows={2} maxLength={1600} aria-label="Ask FixRelay agent" /><Button type="submit" disabled={props.working}>{props.working ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />} Run agent</Button></form>
          {props.agentAnswer && <div className="agent-response"><div className="agent-response-meta"><CheckCircle2 size={15} /> Response from {props.agentProvider || 'agent'}</div><p>{props.agentAnswer}</p></div>}
        </Panel>
      </div>

      <div className="content-side">
        <Panel className="side-panel"><div className="side-panel-heading"><div><p className="eyebrow">AT A GLANCE</p><h3>Home inventory</h3></div><button className="text-link" onClick={() => props.onNavigate('Devices')}>View all <ArrowUpRight size={14} /></button></div>
          <div className="inventory-preview">{devices.slice(0, 4).map((device, index) => <button className="inventory-row" key={device.id} onClick={() => { props.setDeviceQuery(device.name); props.setIssue(`Tell me the safest next step for ${device.name}.`); document.getElementById('device-query')?.focus(); }}><span className={`device-glyph glyph-${index % 4}`}><HardDrive size={17} /></span><span className="inventory-info"><strong>{device.name}</strong><span>{device.category} · {device.room}</span></span><ChevronRight size={16} className="row-chevron" /></button>)}</div>
          <button className="side-panel-bottom" onClick={() => props.onNavigate('Devices')}><Plus size={15} /> Manage device inventory <ArrowRight size={14} /></button>
        </Panel>

        <Panel className="side-panel"><div className="side-panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Repair cases</h3></div><button className="text-link" onClick={() => props.onNavigate('Repair cases')}>View all <ArrowUpRight size={14} /></button></div>
          <div className="recent-list">{dashboard?.recentCases.length ? dashboard.recentCases.slice(0, 4).map((item) => <button className="recent-row" key={item.id} onClick={() => { void props.onOpenCase(item.id); props.onNavigate('Repair cases'); }}><span className={`recent-marker severity-${item.severity}`}><Wrench size={14} /></span><span className="recent-copy"><strong>{item.deviceName}</strong><span>{item.issue}</span><small>{shortDate(item.createdAt)} · {item.status}</small></span><ChevronRight size={15} className="row-chevron" /></button>) : <div className="side-empty"><Clock3 size={18} /><span>No repair cases yet. Investigate an issue to start one.</span></div>}</div>
        </Panel>

        <div className="trust-card"><div className="trust-card-icon"><ShieldCheck size={21} /></div><div><strong>Know what is real.</strong><p>Every excerpt is source-labelled. Warranty dates are calculations, and service options are illustrative until you verify them.</p><button onClick={() => props.onNavigate('MCP lab')}>Inspect MCP tools <ArrowRight size={14} /></button></div></div>
      </div>
    </div>
  </>;
}

function InvestigationPanel({ result, onCreateCase, working }: { result: Investigation; onCreateCase: () => void; working: boolean }) {
  return <Panel className="result-panel">
    <div className="result-head"><div><span className="step-kicker"><span>02</span> INVESTIGATION SUMMARY</span><h2>{result.device ? result.device.name : 'General guidance'}</h2><p className="muted">Issue: {result.issue}</p></div><StatusPill tone={result.severity === 'urgent' || result.severity === 'high' ? 'red' : result.severity === 'medium' ? 'amber' : 'blue'}>{result.severity.toUpperCase()} PRIORITY</StatusPill></div>
    {result.safetyGuidance.length > 0 && <div className={classNames('safety-callout', (result.severity === 'urgent' || result.severity === 'high') && 'safety-callout-high')}><div className="safety-callout-icon"><ShieldCheck size={18} /></div><div><strong>Start with safety</strong><ul>{result.safetyGuidance.map((step) => <li key={step}>{step}</li>)}</ul></div></div>}
    <div className="result-subgrid">
      <div className="result-detail-card"><div className="result-detail-title"><BadgeCheck size={17} /><strong>Warranty date window</strong></div>{result.warranty ? <><div className="warranty-state">{result.warranty.state}</div><div className="warranty-date">Calculated expiry <strong>{formatDate(result.warranty.calculatedExpiryDate)}</strong></div><p className="tiny-muted">Based on saved purchase date and duration only—not a coverage decision.</p></> : <p className="muted text-sm">Match a device to calculate a date window.</p>}</div>
      <div className="result-detail-card"><div className="result-detail-title"><BookOpen size={17} /><strong>Retrieved evidence</strong><span className="count-badge">{result.evidence.length}</span></div>{result.evidence.length ? <div className="evidence-mini-list">{result.evidence.slice(0, 2).map((entry) => <EvidenceMini key={entry.id} evidence={entry} />)}</div> : <p className="muted text-sm">No matching source excerpt was found. The system avoids inventing manual instructions.</p>}</div>
    </div>
    <div className="next-steps-block"><div className="result-detail-title"><CheckCircle2 size={17} /><strong>Recommended next steps</strong></div><ol>{result.recommendedNextSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></div>
    <div className="service-options"><div className="result-detail-title"><Wrench size={17} /><strong>Resolution options</strong><span className="label-demo">ILLUSTRATIVE</span></div><div className="service-option-grid">{result.serviceOptions.map((option) => <div className="service-option" key={option.id}><strong>{option.label}</strong><p>{option.description}</p><span>{option.estimatedResponse}</span></div>)}</div></div>
    <div className="result-disclaimer"><CircleAlert size={14} /><span>{result.disclaimer}</span></div>
    {result.device && <div className="result-actions"><span className="helper-text"><ShieldCheck size={14} /> Creates a local draft only after your confirmation</span><Button onClick={onCreateCase} disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : <FileCheck2 size={16} />} Create repair-case draft</Button></div>}
  </Panel>;
}
function EvidenceMini({ evidence }: { evidence: Evidence }) {
  return <div className="evidence-mini"><div className="evidence-mini-top"><span className="source-icon"><FileText size={15} /></span><span><strong>{evidence.title}</strong><small>{evidence.section}</small></span></div><p>{evidence.excerpt}</p><div className="evidence-source"><span className={evidence.verified ? 'source-verified' : 'source-unverified'}>{evidence.verified ? 'Source marked verified' : 'Unverified / demo source'}</span><span>{evidence.safetyLevel} risk</span></div><p className="evidence-source-note">{evidence.sourceNote}{evidence.sourceUrl && <> <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Open submitted reference <ArrowUpRight size={11} /></a></>}</p></div>;
}

function DevicesPage({ devices, search, setSearch, showAdd, setShowAdd, form, setForm, onAdd, working }: {
  devices: Device[]; search: string; setSearch: (value: string) => void; showAdd: boolean; setShowAdd: (value: boolean) => void;
  form: DeviceForm;
  setForm: (value: DeviceForm) => void; onAdd: (event: FormEvent) => void; working: boolean;
}) {
  return <>
    <SectionHeading eyebrow="YOUR ASSETS" title="Device inventory" description="Keep product details and purchase records together so investigations start with context." action={<Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? <X size={16} /> : <Plus size={16} />}{showAdd ? 'Close form' : 'Add device'}</Button>} />
    {showAdd && <Panel className="add-device-panel">
      <div className="panel-heading compact"><div><h2>Add a device</h2><p className="muted">Enter known product details. Serial number is optional and stored locally.</p></div></div>
      <form className="device-form" onSubmit={onAdd}>
        <label>Name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Living room purifier" /></label>
        <label>Brand<input maxLength={100} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand or maker" /></label>
        <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Air purifier</option><option>Robot vacuum</option><option>Coffee maker</option><option>Electric kettle</option><option>Refrigerator</option><option>Washer</option><option>Other appliance</option></select></label>
        <label>Model<input required maxLength={100} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model number" /></label>
        <label>Serial number<input maxLength={100} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Optional" /></label>
        <label>Purchase date<input required type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></label>
        <label>Warranty duration (months)<input required type="number" min={0} max={120} value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: Number(e.target.value) })} /></label>
        <label>Room<input maxLength={100} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></label>
        <details className="reference-details"><summary>Attach product reference (optional)</summary>
          <p className="tiny-muted">Only submit text and links you have permission to use. FixRelay does not fetch or authenticate the page. All submitted excerpts remain unverified.</p>
          <label>Reference title<input maxLength={160} value={form.referenceTitle} onChange={(e) => setForm({ ...form, referenceTitle: e.target.value })} placeholder="e.g. User manual, safety section" /></label>
          <label>Section / page<input maxLength={160} value={form.referenceSection} onChange={(e) => setForm({ ...form, referenceSection: e.target.value })} placeholder="e.g. Safety, p. 12" /></label>
          <label>Reference URL<input type="url" maxLength={2048} value={form.referenceUrl} onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })} placeholder="https://manufacturer.example/manual" /></label>
          <label>Permitted excerpt<textarea maxLength={8000} rows={4} value={form.referenceExcerpt} onChange={(e) => setForm({ ...form, referenceExcerpt: e.target.value })} placeholder="Paste a short excerpt you are allowed to use. Avoid personal or confidential information." /></label>
        </details>
        <div className="device-form-actions"><span className="tiny-muted">Reference excerpts are labelled unverified. A URL is shown as provenance, not proof of authenticity.</span><Button type="submit" disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save device</Button></div>
      </form>
    </Panel>}
    <Panel className="inventory-panel"><div className="table-toolbar"><div><h3>All devices <span className="count-badge">{devices.length}</span></h3><p className="muted">Inventory records stored in PostgreSQL.</p></div><div className="table-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, model or room" aria-label="Search devices" /></div></div>
      {devices.length ? <div className="table-scroll"><table><thead><tr><th>DEVICE</th><th>CATEGORY</th><th>LOCATION</th><th>PURCHASED</th><th>WARRANTY (DATE WINDOW)</th><th>CONDITION</th></tr></thead><tbody>{devices.map((device, index) => <tr key={device.id}><td><div className="table-device"><span className={`device-glyph glyph-${index % 4}`}><HardDrive size={17} /></span><span><strong>{device.name}</strong><small>{device.brand} · {device.model}</small></span></div></td><td>{device.category}</td><td>{device.room}</td><td>{formatDate(device.purchaseDate)}</td><td><span className="warranty-cell"><BadgeCheck size={15} />{device.warrantyMonths} months recorded</span></td><td><StatusPill tone={/attention|fault|broken/i.test(device.condition) ? 'amber' : 'green'}>{device.condition}</StatusPill></td></tr>)}</tbody></table></div> : <EmptyState icon={HardDrive} title="No matching devices" description="Try another search or add a device to your local inventory." />}
      <div className="table-footnote"><ShieldCheck size={14} /> Product names and sample records in this workspace may be synthetic demo data.</div>
    </Panel>
  </>;
}

function CasesPage({ cases, caseDetail, onOpen, onClear }: { cases: RepairCase[]; caseDetail: RepairCase | null; onOpen: (id: string) => void; onClear: () => void }) {
  return <>
    <SectionHeading eyebrow="FOLLOW THROUGH" title="Repair cases" description="Track local case drafts, recorded evidence and follow-up history. Nothing is sent to an outside provider." />
    <div className={classNames('cases-layout', caseDetail && 'cases-layout-detail')}><Panel className="cases-list-panel"><div className="table-toolbar"><div><h3>Case history <span className="count-badge">{cases.length}</span></h3><p className="muted">Newest first</p></div><div className="filter-chip"><Activity size={14} /> All cases <ChevronDown size={14} /></div></div>
      {cases.length ? cases.map((item) => <button className={classNames('case-list-row', caseDetail?.id === item.id && 'case-list-row-active')} key={item.id} onClick={() => onOpen(item.id)}><span className={`case-severity-icon severity-${item.severity}`}><Wrench size={17} /></span><span className="case-row-main"><strong>{item.deviceName}</strong><span>{item.issue}</span><small>{item.id} · {shortDate(item.createdAt)}</small></span><span className="case-row-end"><StatusPill tone={item.status === 'Resolved' ? 'green' : item.severity === 'high' || item.severity === 'urgent' ? 'red' : 'blue'}>{item.status}</StatusPill><ChevronRight size={15} /></span></button>) : <EmptyState icon={FileCheck2} title="No repair cases yet" description="Run an investigation and explicitly approve a local case draft to see the workflow here." />}
    </Panel>
    {caseDetail && <Panel className="case-detail-panel"><div className="case-detail-head"><div><p className="eyebrow">CASE DETAIL</p><h3>{caseDetail.deviceName}</h3><span className="tiny-muted">{caseDetail.id}</span></div><button className="icon-button" onClick={onClear} aria-label="Close case detail"><X size={17} /></button></div><StatusPill tone={caseDetail.status === 'Resolved' ? 'green' : 'blue'}>{caseDetail.status}</StatusPill><div className="case-field"><span>Reported issue</span><p>{caseDetail.issue}</p></div><div className="case-field"><span>Summary</span><p>{caseDetail.summary}</p></div><div className="case-field"><span>Warranty record</span><p>{caseDetail.warrantyState}</p></div><div className="case-field"><span>Resolution status</span><p>{caseDetail.resolution}</p></div><div className="timeline-heading"><Activity size={16} /><strong>Timeline</strong></div><div className="timeline">{(caseDetail.events ?? []).map((event: CaseEvent) => <div className="timeline-row" key={event.id}><span className="timeline-dot" /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{formatDate(event.createdAt)}</small></div></div>)}</div><div className="detail-note"><CircleAlert size={14} /> Local record only. No external request has been sent.</div></Panel>}
    </div>
  </>;
}

function McpPage({ mcpTool, setMcpTool, mcpArgs, setMcpArgs, tools, result, meta, onRun, working }: {
  mcpTool: string; setMcpTool: (value: string) => void; mcpArgs: string; setMcpArgs: (value: string) => void;
  tools: Array<{ name: string; description?: string }>; result: string; meta: string; onRun: (event: FormEvent) => void; working: boolean;
}) {
  const protocolConnected = meta.startsWith('Connected');
  const protocolFailed = /failed|error/i.test(meta) && !working;
  const defaultArgs: Record<string, string> = {
    search_devices: '{"query":"air purifier"}', get_device: '{"deviceId":"demo-pureair-450"}',
    search_manual: '{"query":"grinding noise","deviceId":"demo-pureair-450"}', evaluate_warranty: '{"deviceId":"demo-pureair-450"}',
    find_service_options: '{"issue":"The device is making a grinding noise."}', get_case_status: '{"caseId":"replace-with-a-real-case-id"}',
    create_repair_case: '{"deviceId":"...","issue":"...","summary":"...","sessionId":"...","approvalToken":"..."}',
    add_case_note: '{"caseId":"replace-with-a-real-case-id","note":"Follow-up requested by the user."}',
  };
  return <>
    <SectionHeading eyebrow="DEVELOPER EXPERIENCE" title="MCP lab" description="Inspect the real Model Context Protocol endpoint from a browser-side client. The endpoint uses Streamable HTTP and serves the 2025-11-25 protocol family." action={<StatusPill tone={meta.startsWith('Connected') ? 'green' : 'neutral'}>{meta.startsWith('Connected') ? 'Connected' : 'Ready to connect'}</StatusPill>} />
    <div className="mcp-grid"><Panel className="mcp-client-panel"><div className="mcp-panel-title"><div className="mcp-terminal-icon"><Command size={18} /></div><div><h3>Request builder</h3><p className="muted">Initialize → tools/list → tools/call</p></div></div><div className="protocol-steps"><div className={classNames('protocol-step', protocolConnected && 'complete', protocolFailed && 'failed')}><span>1</span><div><strong>Initialize</strong><small>Negotiate protocol version</small></div>{protocolConnected ? <CheckCircle2 size={16} /> : protocolFailed ? <CircleAlert size={16} /> : <Clock3 size={16} />}</div><div className={classNames('protocol-step', protocolConnected && 'complete', protocolFailed && 'failed')}><span>2</span><div><strong>Discover tools</strong><small>Request tools/list</small></div>{protocolConnected ? <CheckCircle2 size={16} /> : protocolFailed ? <CircleAlert size={16} /> : <Clock3 size={16} />}</div><div className={classNames('protocol-step', protocolConnected && 'complete', protocolFailed && 'failed')}><span>3</span><div><strong>Execute tool</strong><small>Request tools/call</small></div>{protocolConnected ? <CheckCircle2 size={16} /> : protocolFailed ? <CircleAlert size={16} /> : <Clock3 size={16} />}</div></div><form className="mcp-form" onSubmit={onRun}><label className="field-label" htmlFor="mcp-tool">Tool</label><select id="mcp-tool" value={mcpTool} onChange={(event) => { setMcpTool(event.target.value); setMcpArgs(defaultArgs[event.target.value] ?? '{}'); }}><option value="search_devices">search_devices — search inventory</option><option value="get_device">get_device — device details</option><option value="search_manual">search_manual — retrieve evidence</option><option value="evaluate_warranty">evaluate_warranty — calculate date window</option><option value="find_service_options">find_service_options — next steps</option><option value="get_case_status">get_case_status — case history</option><option value="create_repair_case">create_repair_case — requires valid one-use token</option><option value="add_case_note">add_case_note — append a local case note</option></select><label className="field-label" htmlFor="mcp-args">JSON arguments</label><textarea id="mcp-args" className="code-input" value={mcpArgs} onChange={(event) => setMcpArgs(event.target.value)} rows={6} spellCheck={false} /><Button type="submit" disabled={working} className="w-full">{working ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />} Run real MCP request</Button></form></Panel>
      <Panel className="mcp-response-panel"><div className="mcp-panel-title"><div className="mcp-response-icon"><Activity size={18} /></div><div><h3>Protocol response</h3><p className="muted">JSON-RPC payload from the server</p></div><StatusPill tone={meta.startsWith('Connected') ? 'green' : 'amber'}>{meta.startsWith('Connected') ? 'Success' : 'Pending'}</StatusPill></div><div className="mcp-meta-strip"><span className="live-dot" />{meta}</div><div className="code-window"><div className="code-window-bar"><div><span /><span /><span /></div><small>response.json</small><button onClick={() => navigator.clipboard?.writeText(result)} className="code-copy">Copy</button></div><pre>{result}</pre></div><div className="mcp-tools-block"><div className="mcp-tools-header"><strong>Discovered tools</strong><span className="count-badge">{tools.length}</span></div>{tools.length ? <div className="mcp-tool-list">{tools.map((tool) => <button key={tool.name} onClick={() => { setMcpTool(tool.name); setMcpArgs(defaultArgs[tool.name] ?? '{}'); }}><span className="tool-method">TOOL</span><span><strong>{tool.name}</strong><small>{tool.description ?? 'No description provided.'}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="muted text-sm">Run a request to display tools returned by the live endpoint.</p>}</div></Panel></div>
    <div className="mcp-bottom-note"><ShieldCheck size={17} /><div><strong>Mutation boundary</strong><p>Creating a case requires an approval token issued after explicit user confirmation in the FixRelay UI. Tokens are short-lived, single-use, and bound to one exact request. This lab intentionally cannot mint its own approval token.</p></div></div>
  </>;
}
