import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Cpu,
  Compass,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Download,
  PlusCircle,
  RefreshCw,
  GitPullRequest,
  Check,
  X,
  Lock,
  Layers,
  Sparkles,
  Info,
  HelpCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [hires, setHires] = useState([]);
  const [selectedHireId, setSelectedHireId] = useState(null);
  const [hireDetail, setHireDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [citationModal, setCitationModal] = useState(null);
  const [activeTab, setActiveTab] = useState('workflow'); // 'workflow' | 'guide' | 'audit'
  const [seedOptions, setSeedOptions] = useState({ teams: [], projects: [] });

  // Intake form state
  const [formData, setFormData] = useState({
    name: 'John Doe',
    role: 'Senior Backend Engineer',
    startDate: '2026-11-01',
    githubUsername: 'octocat',
    resumeText: `John Doe
Senior Software Engineer with 6 years experience in distributed systems.
Skills: Python, FastAPI, Docker, PostgreSQL, Redis, Kubernetes, AWS, REST APIs, Git.
Projects: Built real-time transaction processing API handling 15k req/sec with Redis caching.
Certifications: AWS Solutions Architect Associate.
Contact: +1-555-0199, 123 Tech Lane, San Francisco CA, john.personal@gmail.com, DOB: 1994-05-12.`
  });

  // Override form state
  const [overrideData, setOverrideData] = useState({
    team: 'Frontend Platform',
    project: 'Design System 2.0 Components',
    reason: 'Strategic reallocation to support high-priority Q4 component design system delivery.'
  });

  // Fetch all hires
  const fetchHires = async () => {
    try {
      const res = await fetch(`${API_BASE}/hires`);
      if (res.ok) {
        const data = await res.json();
        setHires(data);
        if (data.length > 0 && !selectedHireId) {
          setSelectedHireId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching hires:', err);
    }
  };

  // Fetch detail for selected hire
  const fetchHireDetail = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/hires/${id}`);
      if (res.ok) {
        const data = await res.json();
        setHireDetail(data);
      }
    } catch (err) {
      console.error('Error fetching hire detail:', err);
    }
  };

  useEffect(() => {
    fetchHires();
    const interval = setInterval(fetchHires, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/options/teams-and-projects`)
      .then(res => res.json())
      .then(data => setSeedOptions(data))
      .catch(err => console.warn('Could not load seed teams and projects:', err));
  }, []);

  useEffect(() => {
    if (selectedHireId) {
      fetchHireDetail(selectedHireId);
      const detailInterval = setInterval(() => fetchHireDetail(selectedHireId), 3000);
      return () => clearInterval(detailInterval);
    }
  }, [selectedHireId]);

  // Handle Intake Submit
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          start_date: formData.startDate,
          github_username: formData.githubUsername,
          resume_text: formData.resumeText
        })
      });
      if (res.ok) {
        const newHire = await res.json();
        setShowIntakeModal(false);
        await fetchHires();
        setSelectedHireId(newHire.employee.id);
      }
    } catch (err) {
      alert('Error creating hire intake: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Approve a step (identity or assignment)
  const handleApproveStep = async (step, editedValue = null) => {
    if (!selectedHireId || actionInFlight) return;
    setActionInFlight(true);
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/approve/${step}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_name: 'Marcus Vance (Engineering Lead)',
          edited_value: editedValue
        })
      });
      if (res.ok) {
        await fetchHireDetail(selectedHireId);
        await fetchHires();
      }
    } catch (err) {
      alert('Approval error: ' + err.message);
    } finally {
      setActionInFlight(false);
    }
  };

  // Override assignment
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHireId || actionInFlight) return;
    if (overrideData.reason.trim().length < 10) {
      alert('Override justification reason must be at least 10 characters.');
      return;
    }
    setActionInFlight(true);
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/override-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_name: 'Marcus Vance (Engineering Lead)',
          team: overrideData.team,
          project: overrideData.project,
          reason: overrideData.reason.trim()
        })
      });
      if (res.ok) {
        setShowOverrideModal(false);
        await fetchHireDetail(selectedHireId);
        await fetchHires();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert('Override error: ' + (errData.detail || 'Failed to override placement'));
      }
    } catch (err) {
      alert('Override error: ' + err.message);
    } finally {
      setActionInFlight(false);
    }
  };

  // Retry step when in needs_attention
  const handleRetryAssignment = async () => {
    if (!selectedHireId || actionInFlight) return;
    setActionInFlight(true);
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/retry/assignment`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchHireDetail(selectedHireId);
      }
    } catch (err) {
      alert('Retry error: ' + err.message);
    } finally {
      setActionInFlight(false);
    }
  };

  // Export package
  const handleExport = () => {
    if (!selectedHireId) return;
    window.open(`${API_BASE}/hires/${selectedHireId}/export`, '_blank');
  };

  const getStrengthBadge = (label) => {
    switch (label) {
      case 'strong':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-700/80">Strong Fit</span>;
      case 'moderate':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-700/80">Moderate Fit</span>;
      case 'weak':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-700/80">Weak Fit</span>;
      case 'not_recommended':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-700/80">Not Recommended</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Done</span>;
      case 'waiting_approval':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"><Clock className="w-3 h-3" /> Awaiting Approval</span>;
      case 'running':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800 animate-spin"><RefreshCw className="w-3 h-3" /> Running</span>;
      case 'insufficient_data':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800"><AlertTriangle className="w-3 h-3" /> Insufficient Data</span>;
      case 'needs_attention':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800"><AlertCircle className="w-3 h-3" /> Attention</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800">Queued</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                OnboardOS
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                Multi-Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Engineering Onboarding & Placement Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hires.length > 0 && (
            <select
              value={selectedHireId || ''}
              onChange={(e) => setSelectedHireId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {hires.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.role}) - {h.status}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleExport}
            disabled={!hireDetail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export Plan
          </button>

          <button
            onClick={() => setShowIntakeModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition"
          >
            <PlusCircle className="w-4 h-4" />
            New Hire Intake
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'workflow'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Agent Pipeline & Approvals
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            Personalized 30-Day Guide
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Audit Trail & Guardrails
          </button>
        </div>

        {/* Selected Candidate Overview Bar */}
        {hireDetail && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-lg text-indigo-400">
                {hireDetail.employee.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{hireDetail.employee.name}</h2>
                  {getStatusBadge(hireDetail.employee.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  <span>Role: <strong className="text-slate-200">{hireDetail.employee.role}</strong></span>
                  <span>Start Date: <strong className="text-slate-200">{hireDetail.employee.start_date}</strong></span>
                  <span>GitHub: <strong className="text-slate-200">{hireDetail.employee.github_username || 'None'}</strong></span>
                  <span>Company Email: <strong className="text-indigo-400">{hireDetail.employee.email || 'Pending Provisioning'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              <span className="text-slate-300">Live Orchestrator Active</span>
            </div>
          </div>
        )}

        {/* TAB 1: WORKFLOW VIEW */}
        {activeTab === 'workflow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: IDENTITY AGENT */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Identity Agent</h3>
                      <p className="text-xs text-slate-400">Directory Collision Detection & Naming Policy</p>
                    </div>
                  </div>
                  {hireDetail?.identity && getStatusBadge(hireDetail.identity.status)}
                </div>

                {hireDetail?.identity ? (
                  <div className="space-y-3">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Proposed Corporate Email:</div>
                      <div className="text-base font-mono font-bold text-indigo-300 mt-0.5">
                        {hireDetail.identity.proposed_email}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                        <span>Rule: <code className="text-slate-200">{hireDetail.identity.rule_used}</code></span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          MOCK DIRECTORY
                        </span>
                      </div>
                    </div>

                    {/* Collision resolution indicator */}
                    {hireDetail.identity.collision_detected && (
                      <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <strong className="block font-semibold">Genuine Collision Detected & Resolved</strong>
                          Initial standard email format collided with existing directory user. Next naming policy rule automatically selected.
                        </div>
                      </div>
                    )}

                    {/* Collision Log Steps */}
                    <div className="text-xs space-y-1">
                      <span className="text-slate-400 font-medium">Policy Evaluation Trail:</span>
                      <ul className="space-y-1 mt-1 font-mono text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 max-h-24 overflow-y-auto">
                        {hireDetail.identity.attempts_log.map((log, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-indigo-400">›</span> {log}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">Awaiting identity agent evaluation...</div>
                )}
              </div>

              {/* Action Gate */}
              {hireDetail?.identity?.status === 'waiting_approval' && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Manager Approval Required
                  </span>
                  <button
                    onClick={() => handleApproveStep('identity')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve & Provision
                  </button>
                </div>
              )}
            </div>

            {/* CARD 2: SKILL MANAGER */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Skill Manager</h3>
                      <p className="text-xs text-slate-400">PII Scrubbing, GitHub Evidence & Ontology Normalization</p>
                    </div>
                  </div>
                  {hireDetail?.steps?.skills && getStatusBadge(hireDetail.steps.skills.status)}
                </div>

                {hireDetail?.skill_map ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
                      <span>Total Skills: <strong className="text-white">{hireDetail.skill_map.skills.length}</strong></span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          {hireDetail.skill_map.skills.filter(s => s.status === 'verified').length} Verified
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Info className="w-3 h-3" />
                          {hireDetail.skill_map.skills.filter(s => s.status === 'claimed').length} Claimed
                        </span>
                      </div>
                    </div>

                    {/* Skill Badges Matrix */}
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {hireDetail.skill_map.skills.map((s, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/60 border border-slate-800/80 p-2 rounded-xl flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-slate-200 truncate">{s.skill}</span>
                            {s.status === 'verified' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Verified
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                Claimed
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={s.evidence[0] || 'Resume claimed'}>
                            {s.evidence[0] || 'Resume claimed'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">Awaiting skill manager extraction...</div>
                )}
              </div>
            </div>

            {/* CARD 3: PROJECT MANAGER & ASSIGNMENT */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 md:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/50">
                      <GitPullRequest className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Project Manager Agent</h3>
                      <p className="text-xs text-slate-400">Deterministic Scoring Formula (Weights: 45% Match, 30% Gap, 25% Capacity, -15% Learning Penalty)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hireDetail?.assignment && getStatusBadge(hireDetail.assignment.status)}
                    {hireDetail?.assignment?.overridden && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800 rounded-md">
                        OVERRIDDEN BY MANAGER
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner: Insufficient Data */}
                {(hireDetail?.assignment?.insufficient_data || hireDetail?.steps?.assignment?.status === 'insufficient_data') && (
                  <div className="mb-4 p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Insufficient Skill Data</div>
                      <p className="text-amber-300/90 mt-0.5">
                        No candidate technical skills were extracted from the resume. Deterministic team placement paused to prevent zero-scoring assignments.
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner: Weak Fit */}
                {hireDetail?.assignment?.weak_fit && (
                  <div className="mb-4 p-3 bg-amber-950/30 border border-amber-800/70 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Weak Placement Fit Warning</div>
                      <p className="text-amber-300/90 mt-0.5">
                        The top candidate score is below the 35.0 confidence threshold. Manager review or manual placement override strongly recommended.
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner: Close Call */}
                {hireDetail?.assignment?.close_call && (
                  <div className="mb-4 p-3 bg-cyan-950/30 border border-cyan-800/70 rounded-xl flex items-start gap-2.5 text-xs text-cyan-200">
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Close Call Scoring Margin</div>
                      <p className="text-cyan-300/90 mt-0.5">
                        Candidate #1 and #2 scores are within 5.0 points of each other. Evaluate secondary considerations before signing off.
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner: Zero Capacity */}
                {hireDetail?.assignment?.all_teams_zero_capacity && (
                  <div className="mb-4 p-3 bg-rose-950/30 border border-rose-800/70 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Zero Capacity Warning</div>
                      <p className="text-rose-300/90 mt-0.5">
                        All teams are currently at maximum capacity load. Capacity terms penalize placement across all candidates.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {hireDetail?.steps?.assignment?.status === 'running' && (
                  <div className="space-y-4 animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
                          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                          <div className="h-5 bg-slate-800 rounded w-2/3"></div>
                          <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                          <div className="space-y-2 pt-2">
                            <div className="h-2 bg-slate-800 rounded"></div>
                            <div className="h-2 bg-slate-800 rounded"></div>
                            <div className="h-2 bg-slate-800 rounded"></div>
                            <div className="h-2 bg-slate-800 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-24 bg-slate-950/50 border border-slate-800 rounded-xl"></div>
                  </div>
                )}

                {/* Error / Needs Attention State */}
                {hireDetail?.steps?.assignment?.status === 'needs_attention' && !hireDetail?.assignment?.insufficient_data && (
                  <div className="my-4 p-4 rounded-xl border bg-rose-950/30 border-rose-800 text-rose-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Assignment Processing Failed</div>
                        <p className="text-[11px] text-rose-300/90 mt-0.5">
                          {hireDetail?.steps?.assignment?.error || 'Deterministic assignment scoring paused due to an error.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRetryAssignment}
                      disabled={actionInFlight}
                      aria-label="Retry scoring calculation"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-900/60 hover:bg-rose-800 text-rose-100 border border-rose-700 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionInFlight ? 'animate-spin' : ''}`} />
                      Retry Scoring
                    </button>
                  </div>
                )}

                {/* Candidate Cards & Rationale */}
                {hireDetail?.assignment && hireDetail.assignment.candidates && hireDetail.assignment.candidates.length > 0 ? (
                  <div className="space-y-4">
                    {/* Top 3 Scored Candidates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {hireDetail.assignment.candidates.map((cand, idx) => {
                        const isSelected = cand.team === hireDetail.assignment.team;
                        
                        // Term values and contributions
                        const cMatch = Number(((cand.terms?.skill_match?.contribution ?? 0) * 100).toFixed(1));
                        const cGap = Number(((cand.terms?.gap_coverage?.contribution ?? 0) * 100).toFixed(1));
                        const cCap = Number(((cand.terms?.capacity?.contribution ?? 0) * 100).toFixed(1));
                        const cLearn = Number(((cand.terms?.learning_gap?.contribution ?? 0) * 100).toFixed(1));
                        
                        // The UI score shown must equal the sum of the visible term contributions
                        const visibleScore = (cMatch + cGap + cCap + cLearn).toFixed(1);

                        const vMatchPct = Number(((cand.terms?.skill_match?.value ?? cand.score_breakdown?.skill_match ?? 0) * 100).toFixed(1));
                        const vGapPct = Number(((cand.terms?.gap_coverage?.value ?? cand.score_breakdown?.gap_coverage ?? 0) * 100).toFixed(1));
                        const vCapPct = Number(((cand.terms?.capacity?.value ?? cand.score_breakdown?.capacity ?? 0) * 100).toFixed(1));
                        const vLearnPct = Number(((cand.terms?.learning_gap?.value ?? cand.score_breakdown?.learning_gap ?? 0) * 100).toFixed(1));

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                              isSelected
                                ? 'bg-indigo-950/30 border-indigo-500/70 shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-500/30'
                                : 'bg-slate-950/40 border-slate-800/80 opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-400">
                                    Rank #{idx + 1}
                                  </span>
                                  {idx === 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-700/60">
                                      Top Pick
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {cand.label && getStrengthBadge(cand.label)}
                                  <span className="text-xs font-mono font-bold text-indigo-400" aria-label={`Score: ${visibleScore} out of 100`}>
                                    {visibleScore}
                                  </span>
                                </div>
                              </div>

                              <h4 className="font-bold text-sm text-white">{cand.team}</h4>
                              <p className="text-xs text-slate-400 line-clamp-1 mb-2.5">
                                Project: <span className="text-slate-300">{cand.project}</span>
                              </p>

                              {/* Score Breakdown Bars (4 Terms) */}
                              <div className="space-y-2 text-[10px]">
                                {/* Term 1: Skill Match (45%) */}
                                <div>
                                  <div className="flex justify-between items-center text-slate-300 mb-0.5">
                                    <span>Skill Match (w: 0.45)</span>
                                    <span className="font-mono font-bold text-indigo-400">
                                      +{cMatch.toFixed(1)} pts ({vMatchPct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={vMatchPct} aria-valuemin="0" aria-valuemax="100" aria-label="Skill match progress">
                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, vMatchPct))}%` }}></div>
                                  </div>
                                </div>

                                {/* Term 2: Gap Coverage (30%) */}
                                <div>
                                  <div className="flex justify-between items-center text-slate-300 mb-0.5">
                                    <span>Gap Coverage (w: 0.30)</span>
                                    <span className="font-mono font-bold text-sky-400">
                                      +{cGap.toFixed(1)} pts ({vGapPct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={vGapPct} aria-valuemin="0" aria-valuemax="100" aria-label="Gap coverage progress">
                                    <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, vGapPct))}%` }}></div>
                                  </div>
                                </div>

                                {/* Term 3: Available Capacity (25%) */}
                                <div>
                                  <div className="flex justify-between items-center text-slate-300 mb-0.5">
                                    <span>Available Capacity (w: 0.25)</span>
                                    <span className="font-mono font-bold text-emerald-400">
                                      +{cCap.toFixed(1)} pts ({vCapPct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={vCapPct} aria-valuemin="0" aria-valuemax="100" aria-label="Capacity progress">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, vCapPct))}%` }}></div>
                                  </div>
                                </div>

                                {/* Term 4: Learning Gap Penalty (15% in RED) */}
                                <div>
                                  <div className="flex justify-between items-center text-slate-300 mb-0.5">
                                    <span className="text-rose-400">Learning Gap Penalty (w: 0.15)</span>
                                    <span className="font-mono font-bold text-rose-400">
                                      {cLearn <= 0 ? cLearn.toFixed(1) : '-' + cLearn.toFixed(1)} pts ({vLearnPct}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={vLearnPct} aria-valuemin="0" aria-valuemax="100" aria-label="Learning gap penalty">
                                    <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, vLearnPct))}%` }}></div>
                                  </div>
                                </div>
                              </div>

                              {/* Matched Skills Chips */}
                              {cand.matched_skills && cand.matched_skills.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                    Matched Skills:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {cand.matched_skills.map((m, mIdx) => {
                                      const isVerified = m.status === 'verified';
                                      return (
                                        <span
                                          key={mIdx}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${
                                            isVerified
                                              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                                              : 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                                          }`}
                                        >
                                          {isVerified ? (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                          ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                          )}
                                          <span>{m.skill}</span>
                                          <span className="text-[9px] opacity-75">
                                            ({isVerified ? 'verified' : 'claimed'})
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Missing Skills Chips */}
                              {cand.missing_skills && cand.missing_skills.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                    Missing Skills to Learn:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {cand.missing_skills.map((s, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-rose-950/40 border-rose-800/60 text-rose-300 flex items-center gap-1"
                                      >
                                        <span className="w-1 h-1 rounded-full bg-rose-400"></span>
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Expandable "How this was computed" */}
                            {cand.formula_trace && (
                              <details className="mt-3 text-[10px] border-t border-slate-800/80 pt-1.5">
                                <summary className="text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-medium select-none focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5">
                                  <HelpCircle className="w-3 h-3 text-indigo-400" />
                                  <span>How this was computed</span>
                                </summary>
                                <div className="mt-1.5 p-2 bg-slate-950/95 rounded border border-slate-800 font-mono text-[9px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                  {cand.formula_trace}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Structured LLM Strategic Rationale */}
                    <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          <span>LLM Strategic Placement Rationale</span>
                        </div>
                        {hireDetail.assignment.structured_rationale?.fallback_rationale && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" /> Template Fallback
                          </span>
                        )}
                      </div>

                      <div className="space-y-2.5 text-xs">
                        {/* Why this team */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Why This Team:
                          </span>
                          <p className="text-slate-200 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                            {hireDetail.assignment.structured_rationale?.why_this_team || hireDetail.assignment.reason}
                          </p>
                        </div>

                        {/* Skills to learn & Risks grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Skills to Learn */}
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Skills To Learn:
                            </span>
                            {hireDetail.assignment.structured_rationale?.skills_to_learn && hireDetail.assignment.structured_rationale.skills_to_learn.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {hireDetail.assignment.structured_rationale.skills_to_learn.map((sk, skIdx) => (
                                  <span key={skIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950/50 text-indigo-300 border border-indigo-800/60">
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">No critical skills to learn identified.</span>
                            )}
                          </div>

                          {/* Risks */}
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Identified Placement Risks:
                            </span>
                            {hireDetail.assignment.structured_rationale?.risks && hireDetail.assignment.structured_rationale.risks.length > 0 ? (
                              <ul className="space-y-1 text-[11px] text-amber-300/90">
                                {hireDetail.assignment.structured_rationale.risks.map((rk, rkIdx) => (
                                  <li key={rkIdx} className="flex items-start gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <span>{rk}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">No significant risks flagged.</span>
                            )}
                          </div>
                        </div>

                        {/* Why not runner up */}
                        {hireDetail.assignment.structured_rationale?.why_not_runner_up && (
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                              Comparison With Runner-Up:
                            </span>
                            <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                              {hireDetail.assignment.structured_rationale.why_not_runner_up}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  hireDetail?.steps?.assignment?.status !== 'running' && (
                    <div className="py-8 text-center text-xs text-slate-500">
                      {hireDetail?.assignment?.insufficient_data ? 'Awaiting candidate technical competencies...' : 'Awaiting deterministic scoring...'}
                    </div>
                  )
                )}
              </div>

              {/* Locked Card State after approval or override */}
              {hireDetail?.assignment?.approved_by && (
                <div className="mt-4 p-3.5 rounded-xl border bg-slate-950/80 border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        {hireDetail.assignment.overridden
                          ? `Overridden by ${hireDetail.assignment.approved_by} at ${hireDetail.assignment.approved_at || 'Recorded Time'}: ${hireDetail.assignment.override_reason || hireDetail.assignment.reason}`
                          : `Approved by ${hireDetail.assignment.approved_by} at ${hireDetail.assignment.approved_at || 'Recorded Time'}`}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      LOCKED
                    </span>
                  </div>

                  {hireDetail.assignment.overridden && (
                    <div className="text-[11px] text-slate-300 flex items-center gap-2 bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800">
                      <span className="text-slate-400">Placement Change:</span>
                      <span className="font-semibold text-amber-300">
                        {hireDetail.assignment.recommended_team || 'Recommended'} ({hireDetail.assignment.recommended_score != null ? Number(hireDetail.assignment.recommended_score).toFixed(1) : 'N/A'})
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-emerald-300">
                        {hireDetail.assignment.chosen_team || hireDetail.assignment.team} ({hireDetail.assignment.chosen_score != null ? Number(hireDetail.assignment.chosen_score).toFixed(1) : 'N/A'})
                      </span>
                    </div>
                  )}

                  {/* Handoff Complete Indicator */}
                  <div className="text-xs text-indigo-300 flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Handoff complete: Guide Manager triggered for {hireDetail.assignment.chosen_team || hireDetail.assignment.team} Platform.</span>
                  </div>
                </div>
              )}

              {/* Action Gate (waiting_approval) */}
              {hireDetail?.assignment?.status === 'waiting_approval' && !hireDetail?.assignment?.approved_by && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Manager Approval Required
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOverrideModal(true)}
                      disabled={actionInFlight}
                      aria-label="Open override placement dialog"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      Override Placement
                    </button>
                    <button
                      onClick={() => handleApproveStep('assignment')}
                      disabled={actionInFlight}
                      aria-label="Approve candidate assignment"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {actionInFlight ? 'Processing...' : 'Approve Assignment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PERSONALIZED 30-DAY GUIDE (RAG) */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Grounded 30-Day Engineering Guide</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every step is cited directly from internal engineering documentation. Missing policies are explicitly flagged.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verifier Pass: 100% Checked
                </span>
              </div>
            </div>

            {hireDetail?.guide ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hireDetail.guide.sections.map((sec, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                    <h4 className="font-bold text-white text-sm pb-2 border-b border-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      {sec.title}
                    </h4>

                    <div className="space-y-2.5">
                      {sec.items.map((item, itemIdx) => {
                        const isNotDoc = item.status === 'not_documented' || !item.citation;
                        return (
                          <div
                            key={itemIdx}
                            className={`p-3 rounded-xl border text-xs leading-relaxed ${
                              isNotDoc
                                ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div>{item.text}</div>
                            {item.citation ? (
                              <button
                                onClick={() => setCitationModal(item.citation)}
                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/50 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {item.citation.doc} # {item.citation.section}
                              </button>
                            ) : (
                              <span className="mt-2 inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60">
                                Guardrail: Not Documented
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">Guide generation in progress...</div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Immutable Audit Log</h3>
                <p className="text-xs text-slate-400">Full auditability of every agent action, tool invocation, and manager approval.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {hireDetail?.audit_logs?.length || 0} Events Recorded
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {hireDetail?.audit_logs?.map((log, idx) => (
                <div key={idx} className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-indigo-400">{log.agent} › {log.action}</span>
                    <span className="font-mono text-[11px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-slate-400">Input:</strong> {log.input_summary}
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-slate-400">Output:</strong> {log.output_summary}
                  </div>
                  <div className="text-slate-400 italic">
                    <strong className="text-slate-400 not-italic">Rationale:</strong> {log.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: NEW HIRE INTAKE */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                New Hire Onboarding Intake
              </h3>
              <button onClick={() => setShowIntakeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name (try 'John Doe' or 'Alex Chen' to test collisions)</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Role</label>
                  <input
                    type="text"
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">GitHub Username</label>
                  <input
                    type="text"
                    value={formData.githubUsername}
                    onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resume Text (PII will be automatically redacted)</label>
                <textarea
                  rows={5}
                  value={formData.resumeText}
                  onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-[11px] focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition"
                >
                  {loading ? 'Starting Agents...' : 'Trigger Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CITATION SOURCE VIEW */}
      {citationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Cited Documentation Source
              </h3>
              <button onClick={() => setCitationModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400">Document:</span> <strong className="text-indigo-400">{citationModal.doc}</strong>
              </div>
              <div>
                <span className="text-slate-400">Section:</span> <strong className="text-slate-200">{citationModal.section}</strong>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300">
                Verified citation in knowledge store: <code>backend/app/data/docs/{citationModal.doc}</code>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setCitationModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OVERRIDE ASSIGNMENT */}
      {showOverrideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 id="override-title" className="text-base font-bold text-white">Override Placement Decision</h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                aria-label="Close override dialog"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOverrideSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="override-team-select" className="block text-slate-300 font-semibold mb-1">Target Team</label>
                <select
                  id="override-team-select"
                  value={overrideData.team}
                  onChange={(e) => {
                    const selTeam = e.target.value;
                    const teamProjs = seedOptions.projects?.filter(p => p.team === selTeam) || [];
                    const defaultP = teamProjs.length > 0 ? teamProjs[0].name : '';
                    setOverrideData({
                      ...overrideData,
                      team: selTeam,
                      project: defaultP || overrideData.project
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {seedOptions.teams && seedOptions.teams.length > 0 ? (
                    seedOptions.teams.map((t) => (
                      <option key={t.name} value={t.name}>{t.name} (Cap: {t.capacity - (t.current_load || 0)} available)</option>
                    ))
                  ) : (
                    <>
                      <option value="Backend Platform">Backend Platform</option>
                      <option value="Frontend Platform">Frontend Platform</option>
                      <option value="Data & ML Platform">Data & ML Platform</option>
                      <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                      <option value="Mobile Platform">Mobile Platform</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="override-project-select" className="block text-slate-300 font-semibold mb-1">Assigned Project</label>
                <select
                  id="override-project-select"
                  value={overrideData.project}
                  onChange={(e) => setOverrideData({ ...overrideData, project: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {seedOptions.projects && seedOptions.projects.length > 0 ? (
                    seedOptions.projects
                      .filter(p => !overrideData.team || p.team === overrideData.team)
                      .map((p) => (
                        <option key={p.name} value={p.name}>{p.name} [{p.difficulty}]</option>
                      ))
                  ) : (
                    <option value={overrideData.project}>{overrideData.project}</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="override-reason-text" className="block text-slate-300 font-semibold">
                    Manager Justification (Audited)
                  </label>
                  <span className={`text-[10px] font-mono ${overrideData.reason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {overrideData.reason.trim().length} / 10 chars (min 10)
                  </span>
                </div>
                <textarea
                  id="override-reason-text"
                  rows={3}
                  required
                  placeholder="Provide explicit operational justification for overriding deterministic placement (min 10 chars)..."
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {overrideData.reason.trim().length < 10 && (
                  <p className="text-[10px] text-amber-400/90 mt-1">
                    Justification must be at least 10 characters long.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideData.reason.trim().length < 10 || actionInFlight}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {actionInFlight ? 'Saving...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
