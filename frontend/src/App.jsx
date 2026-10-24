import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Cpu,
  Compass,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Download,
  PlusCircle,
  RefreshCw,
  GitPullRequest,
  Check,
  X,
  Lock,
  Layers,
  Info,
  Award,
  BarChart3,
  GitBranch,
  BookOpen,
  UploadCloud,
  FileCheck,
  FlaskConical
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [hires, setHires] = useState([]);
  const [selectedHireId, setSelectedHireId] = useState(null);
  const [hireDetail, setHireDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [citationModal, setCitationModal] = useState(null);
  const [skillEvidenceModal, setSkillEvidenceModal] = useState(null);
  const [activeTab, setActiveTab] = useState('workflow'); // 'workflow' | 'skills' | 'guide' | 'audit'

  // Intake form state
  const [formData, setFormData] = useState({
    name: 'John Doe',
    role: 'Backend',
    startDate: '2026-11-01',
    githubUsername: 'octocat',
    resumeText: `John Doe
Senior Software Engineer with 6 years experience in distributed systems.
Skills: Python, FastAPI, Docker, PostgreSQL, Redis, Kubernetes, AWS, REST APIs, Git.
Projects: Built real-time transaction processing API handling 15k req/sec with Redis caching.
Certifications: AWS Solutions Architect Associate.
Contact: +1-555-0199, 123 Tech Lane, San Francisco CA, john.personal@gmail.com, DOB: 1994-05-12.`
  });

  // Resume upload state
  const [resumeFileName, setResumeFileName] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  const handleResumeFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeUploadError(null);
    setUploadingResume(true);
    setResumeFileName(file.name);

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/parse-resume`, {
        method: 'POST',
        body: uploadData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to extract text from resume.');
      }

      setFormData((prev) => ({
        ...prev,
        resumeText: data.text,
      }));
    } catch (err) {
      setResumeUploadError(err.message);
    } finally {
      setUploadingResume(false);
      e.target.value = '';
    }
  };

  // Form Validation & GitHub verification state
  const [intakeErrors, setIntakeErrors] = useState({});
  const [isValidatingGithub, setIsValidatingGithub] = useState(false);
  const [githubCheckInfo, setGithubCheckInfo] = useState(null);

  const checkGithubUsername = async (username) => {
    const trimmed = (username || '').trim();
    if (!trimmed) {
      setGithubCheckInfo(null);
      setIntakeErrors((prev) => ({ ...prev, githubUsername: null }));
      return true;
    }
    setIsValidatingGithub(true);
    try {
      const res = await fetch(`${API_BASE}/validate-github/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data.exists) {
        setGithubCheckInfo({ status: 'not_found', message: data.error || `GitHub user '${trimmed}' not found` });
        setIntakeErrors((prev) => ({ ...prev, githubUsername: data.error || `GitHub user '${trimmed}' not found` }));
        return false;
      } else {
        setGithubCheckInfo({
          status: 'valid',
          message: data.public_repos !== undefined ? `Verified (${data.public_repos} public repos)` : 'Profile accessible'
        });
        setIntakeErrors((prev) => ({ ...prev, githubUsername: null }));
        return true;
      }
    } catch (err) {
      setGithubCheckInfo(null);
      return true;
    } finally {
      setIsValidatingGithub(false);
    }
  };

  // Load Prepared Sample Hires
  const loadSampleHire = (sampleKey) => {
    setIntakeErrors({});
    setResumeUploadError(null);
    setResumeFileName('');

    if (sampleKey === 'with_github') {
      setFormData({
        name: 'Jordan Hayes',
        role: 'Backend',
        startDate: '2026-11-15',
        githubUsername: 'octocat',
        resumeText: `Jordan Hayes
Senior Distributed Systems Engineer with 6 years experience architecting scalable microservices and transactional platforms.
Technical Skills: Python, FastAPI, Docker, Kubernetes, PostgreSQL, Redis, AWS, REST APIs, Git, Kafka.
Key Projects:
- Architected high-throughput ledger microservice in Python/FastAPI processing 20k events/sec with Redis caching.
- Optimized PostgreSQL database indexes and configured query connection pooling, cutting p99 latency by 65%.
- Implemented zero-downtime Kubernetes rolling deployment pipelines on AWS EKS with Prometheus monitoring.
Certifications: AWS Solutions Architect Associate, Certified Kubernetes Application Developer (CKAD).
Contact: +1 (555) 432-8765, 452 Enterprise Way, Austin TX, jordan.hayes@gmail.com, DOB: 1993-11-04.`
      });
      setGithubCheckInfo({ status: 'valid', message: 'Sample GitHub profile linked (@octocat)' });
    } else {
      setFormData({
        name: 'Elena Rostova',
        role: 'Frontend',
        startDate: '2026-12-01',
        githubUsername: '',
        resumeText: `Elena Rostova
Lead Frontend Engineer with 7 years experience delivering design systems and performant modern web applications.
Technical Skills: TypeScript, React, Tailwind CSS, Next.js, Jest, GraphQL, Webpack, Vite, Node.js, Accessibility (a11y).
Key Projects:
- Spearheaded company-wide React component design system with 50+ accessible UI components used by 12 squads.
- Reduced initial bundle load size by 40% through code splitting, tree shaking, and modern asset optimizations.
- Built end-to-end testing infrastructure using Jest and Playwright with 95% critical path coverage.
Certifications: Meta Frontend Developer Professional Certificate.
Contact: +1 (555) 987-1234, 88 Mission Boulevard, Seattle WA, elena.rostova@outlook.com, DOB: 1992-06-18.`
      });
      setGithubCheckInfo(null);
    }
  };

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
    if (selectedHireId) {
      fetchHireDetail(selectedHireId);
      const detailInterval = setInterval(() => fetchHireDetail(selectedHireId), 3000);
      return () => clearInterval(detailInterval);
    }
  }, [selectedHireId]);

  // Handle Intake Submit
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Full Name is required.';
    }
    if (!formData.role?.trim()) {
      errors.role = 'Role is required.';
    }
    if (!formData.startDate?.trim()) {
      errors.startDate = 'Start Date is required.';
    }

    const trimmedResume = (formData.resumeText || '').trim();
    if (!trimmedResume || trimmedResume.length < 50) {
      errors.resumeText = `Resume must contain at least 50 characters (currently ${trimmedResume.length} characters).`;
    }

    // Check GitHub username existence if provided
    const trimmedGithub = (formData.githubUsername || '').trim();
    if (trimmedGithub) {
      setIsValidatingGithub(true);
      try {
        const checkRes = await fetch(`${API_BASE}/validate-github/${encodeURIComponent(trimmedGithub)}`);
        const checkData = await checkRes.json();
        if (!checkData.exists) {
          errors.githubUsername = checkData.error || `GitHub user '${trimmedGithub}' not found. Please verify spelling.`;
          setGithubCheckInfo({ status: 'not_found', message: errors.githubUsername });
        } else {
          setGithubCheckInfo({
            status: 'valid',
            message: checkData.public_repos !== undefined ? `Verified (${checkData.public_repos} public repos)` : 'Profile accessible'
          });
        }
      } catch (err) {
        console.warn('GitHub check error:', err);
      } finally {
        setIsValidatingGithub(false);
      }
    }

    if (Object.keys(errors).length > 0) {
      setIntakeErrors(errors);
      return;
    }

    setIntakeErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          role: formData.role.trim(),
          start_date: formData.startDate.trim(),
          github_username: trimmedGithub || null,
          resume_text: trimmedResume
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to initialize onboarding intake.');
      }
      const newHire = await res.json();
      setShowIntakeModal(false);
      await fetchHires();
      setSelectedHireId(newHire.employee.id);
    } catch (err) {
      alert('Error creating hire intake: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Approve a step (identity or assignment)
  const handleApproveStep = async (step, editedValue = null) => {
    if (!selectedHireId) return;
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
        fetchHireDetail(selectedHireId);
        fetchHires();
      }
    } catch (err) {
      alert('Approval error: ' + err.message);
    }
  };

  // Override assignment
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHireId) return;
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/override-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_name: 'Marcus Vance (Engineering Lead)',
          team: overrideData.team,
          project: overrideData.project,
          reason: overrideData.reason
        })
      });
      if (res.ok) {
        setShowOverrideModal(false);
        fetchHireDetail(selectedHireId);
        fetchHires();
      }
    } catch (err) {
      alert('Override error: ' + err.message);
    }
  };

  // Export package
  const handleExport = () => {
    if (!selectedHireId) return;
    window.open(`${API_BASE}/hires/${selectedHireId}/export`, '_blank');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Done</span>;
      case 'waiting_approval':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800"><Clock className="w-3 h-3" /> Awaiting Approval</span>;
      case 'running':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800"><RefreshCw className="w-3 h-3 animate-spin" /> Running</span>;
      case 'needs_attention':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800"><AlertCircle className="w-3 h-3" /> Needs Attention</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800">Queued</span>;
    }
  };

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'advanced':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-100 border border-slate-600">Advanced</span>;
      case 'intermediate':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">Intermediate</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-700">Beginner</span>;
    }
  };

  // Group skills by category for display
  const groupSkillsByCategory = (skills = []) => {
    const groups = {};
    skills.forEach((s) => {
      const cat = s.category || 'tool';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  };

  // Compute category statistics for the bar chart
  const getCategoryStats = (skills = []) => {
    const counts = {};
    const confSums = {};
    skills.forEach((s) => {
      const cat = s.category || 'tool';
      counts[cat] = (counts[cat] || 0) + 1;
      confSums[cat] = (confSums[cat] || 0) + (s.confidence || 0.8);
    });
    return Object.keys(counts).map((cat) => ({
      category: cat,
      count: counts[cat],
      avgConfidence: Math.round((confSums[cat] / counts[cat]) * 100)
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'skills'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Evidence Skill Map & Gap Analysis
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
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-lg text-indigo-400">
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
            <span className="text-xs text-slate-500 font-mono">{hireDetail.employee.id?.slice(0, 8)}</span>
          </div>
        )}

        {/* Post-Submission PII Redaction Summary Banner */}
        {hireDetail?.redaction_summary && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-slate-800 border border-slate-700 text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">PII Redaction Applied</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[11px] font-semibold">
                    {hireDetail.redaction_summary.total} {hireDetail.redaction_summary.total === 1 ? 'item' : 'items'} removed
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {hireDetail.redaction_summary.total > 0
                    ? `Removed before AI processing: ${hireDetail.redaction_summary.types_removed.map((t) => t.toUpperCase()).join(', ')}`
                    : 'No PII detected in resume text'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['phone', 'address', 'email', 'dob'].map((field) => (
                <span
                  key={field}
                  className={`px-2 py-0.5 rounded text-xs font-mono border ${
                    hireDetail.redaction_summary[field] > 0
                      ? 'bg-slate-800 border-slate-600 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                >
                  {field.charAt(0).toUpperCase() + field.slice(1)}: {hireDetail.redaction_summary[field]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: WORKFLOW VIEW */}
        {activeTab === 'workflow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* CARD 1: IDENTITY AGENT */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
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

            {/* CARD 2: SKILL MANAGER OVERVIEW */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Skill Manager</h3>
                      <p className="text-xs text-slate-400">PII Redaction, GitHub Verified Portfolios & Citations</p>
                    </div>
                  </div>
                  {hireDetail?.steps?.skills && getStatusBadge(hireDetail.steps.skills.status)}
                </div>

                {hireDetail?.skill_map ? (
                  <div className="space-y-3">
                    {/* Verification State Banner */}
                    <div className="flex items-center justify-between text-xs bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${hireDetail.skill_map.verification_state === 'verified' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className="text-slate-300 font-medium">
                          {hireDetail.skill_map.github_summary || 'Verification Active'}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveTab('skills')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        Detailed Map <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

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

                    {/* Skill Badges Quick Grid */}
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {hireDetail.skill_map.skills.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSkillEvidenceModal(s)}
                          className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-xl flex flex-col justify-between cursor-pointer transition"
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
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-900 text-[10px]">
                            {getLevelBadge(s.level)}
                            <span className="text-slate-400 font-mono">{Math.round((s.confidence || 0.8) * 100)}% conf</span>
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
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 md:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      <GitPullRequest className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Project Manager Agent</h3>
                      <p className="text-xs text-slate-400">Deterministic Scoring Formula (40% Match, 25% Gap, 20% Capacity, -15% Learning)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hireDetail?.assignment && getStatusBadge(hireDetail.assignment.status)}
                    {hireDetail?.assignment?.overridden && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 rounded">
                        Manager Override
                      </span>
                    )}
                  </div>
                </div>

                {hireDetail?.assignment ? (
                  <div className="space-y-4">
                    {/* Top 3 Scored Candidates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {hireDetail.assignment.candidates.map((cand, idx) => {
                        const isSelected = cand.team === hireDetail.assignment.team;
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border transition ${
                              isSelected
                                ? 'bg-indigo-950/30 border-indigo-500/60 shadow-md shadow-indigo-950/50'
                                : 'bg-slate-950/40 border-slate-800/80 opacity-80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold text-slate-400">Rank #{idx + 1}</span>
                              <span className="text-xs font-mono font-bold text-indigo-400">
                                Score: {cand.score_breakdown.total_score}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-white">{cand.team}</h4>
                            <p className="text-xs text-slate-400 line-clamp-1 mb-2">Project: {cand.project}</p>

                            {/* Score Breakdown Bars */}
                            <div className="space-y-1.5 text-[10px]">
                              <div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Skill Match (40%)</span>
                                  <span>{Math.round(cand.score_breakdown.skill_match * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${cand.score_breakdown.skill_match * 100}%` }}></div>
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Available Capacity (20%)</span>
                                  <span>{Math.round(cand.score_breakdown.capacity * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div className="bg-cyan-500 h-1 rounded-full" style={{ width: `${cand.score_breakdown.capacity * 100}%` }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* LLM Strategic Rationale */}
                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                      <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">AI Placement Rationale</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{hireDetail.assignment.reason}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">Awaiting deterministic scoring...</div>
                )}
              </div>

              {/* Action Gate */}
              {hireDetail?.assignment?.status === 'waiting_approval' && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Manager Approval Required
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOverrideModal(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      Override Placement
                    </button>
                    <button
                      onClick={() => handleApproveStep('assignment')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Assignment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED SKILL MAP & GAP ANALYSIS */}
        {activeTab === 'skills' && hireDetail?.skill_map && (
          <div className="space-y-5">
            {/* Header with Verification State */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  Evidence-Backed Technical Skill Map
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Each skill is mapped to a canonical ontology and backed by specific resume quotes or GitHub data.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border flex items-center gap-1.5 ${
                  hireDetail.skill_map.verification_state === 'verified'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  <GitBranch className="w-3.5 h-3.5" />
                  {hireDetail.skill_map.verification_state === 'verified' ? 'GitHub Verified' : 'Resume-Only'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {hireDetail.skill_map.skills.length} skills
                </span>
              </div>
            </div>

            {/* Category Distribution Bar Chart */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Category Breakdown & Confidence
                </h4>
                <span className="text-xs text-slate-400">Deterministic signal aggregation</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                {getCategoryStats(hireDetail.skill_map.skills).map((stat, idx) => (
                  <div key={idx} className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 capitalize">{stat.category}</span>
                      <span className="font-bold text-indigo-400">{stat.count}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Avg Confidence</span>
                        <span>{stat.avgConfidence}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-1.5 rounded-full"
                          style={{ width: `${stat.avgConfidence}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped Skills by Category */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                Skills by Category — click any skill for evidence
              </h4>

              {Object.entries(groupSkillsByCategory(hireDetail.skill_map.skills)).map(([category, skills]) => (
                <div key={category} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-300 capitalize flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-sm bg-indigo-500"></span>
                      {category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{skills.length} skills</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {skills.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSkillEvidenceModal(s)}
                        className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-600 p-3 rounded cursor-pointer transition space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{s.skill}</span>
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

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                          {getLevelBadge(s.level)}
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                            <span>Confidence:</span>
                            <strong className="text-cyan-400">{Math.round((s.confidence || 0.8) * 100)}%</strong>
                          </div>
                        </div>

                        {/* First supporting evidence preview */}
                        <div className="text-[11px] text-slate-400 line-clamp-1 italic bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
                          {s.evidence[0] || 'Click to view evidence'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Per-Team Gap Analysis Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-slate-400" />
                    Per-Team Gap Analysis
                  </h4>
                  <p className="text-xs text-slate-400">Deterministic coverage percentage and skill gap breakdown across engineering teams.</p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(hireDetail.skill_map.gaps_by_team).map(([teamName, gapData]) => {
                  const coverage = gapData.coverage_percent || 0;
                  const matched = gapData.matched_skills || [];
                  const missing = gapData.missing_skills || [];
                  return (
                    <div key={teamName} className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <h5 className="font-bold text-sm text-white">{teamName}</h5>
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            coverage >= 70 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            coverage >= 40 ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                            'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {coverage}% Coverage
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {matched.length} matched / {matched.length + missing.length} required
                        </span>
                      </div>

                      {/* Coverage Progress Bar */}
                      <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                        <div
                          className={`h-1.5 ${
                            coverage >= 70 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-indigo-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${coverage}%` }}
                        ></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block mb-1">Matched Skills:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {matched.length > 0 ? (
                              matched.map((m, mIdx) => (
                                <span key={mIdx} className="px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800 text-[11px]">
                                  ✓ {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic">None</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-1">Missing / Ramp-up Skills:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {missing.length > 0 ? (
                              missing.map((mis, misIdx) => (
                                <span key={misIdx} className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/60 text-[11px]">
                                  + {mis}
                                </span>
                              ))
                            ) : (
                              <span className="text-emerald-400 italic font-semibold">100% Core Skill Match</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERSONALIZED 30-DAY GUIDE (RAG) */}
        {activeTab === 'guide' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Grounded 30-Day Engineering Guide</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every step cites internal engineering documentation. Missing policies are explicitly flagged.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Citation-verified
                </span>
              </div>
            </div>

            {hireDetail?.guide ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {hireDetail.guide.sections.map((sec, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                    <h4 className="font-bold text-white text-sm pb-2 border-b border-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500"></span>
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

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
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
                <div key={idx} className="bg-slate-950 border border-slate-800 p-3.5 rounded space-y-1.5 text-xs">
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

        {/* PRIVACY POLICY */}
        {activeTab === 'privacy' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('workflow')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
              </button>
              <h2 className="text-lg font-bold text-white">Privacy Policy</h2>
            </div>
            <p className="text-xs text-slate-500">Last updated: October 2026</p>

            <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-semibold text-white mb-2">1. Scope</h3>
                <p>OnboardOS is an internal engineering onboarding orchestrator. This policy describes how data entered into the system is handled during the onboarding workflow.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">2. Data Collected</h3>
                <p>The system processes the following data submitted by authorised HR or engineering personnel:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>Candidate full name and intended role</li>
                  <li>Resume or CV text (PDF, DOCX, or plain text)</li>
                  <li>GitHub username (optional, for public repository verification)</li>
                  <li>Intended start date</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">3. Automatic PII Redaction</h3>
                <p>Before any resume text is passed to AI models or stored in the database, the system automatically detects and removes the following classes of personal identifiers:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                  <li>Phone numbers</li>
                  <li>Physical addresses</li>
                  <li>Personal email addresses</li>
                  <li>Dates of birth</li>
                </ul>
                <p className="mt-2">A redaction count is displayed in the UI after submission. The original unredacted text is not stored.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">4. Data Storage</h3>
                <p>Processed data is stored in a local SQLite database. GitHub verification uses the public GitHub API only. No data is sent to third-party services except OpenAI (for the AI explanation and guide generation steps). Data sent to OpenAI has already been PII-redacted.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">5. Audit Trail</h3>
                <p>All agent actions, manager approvals, and overrides are written to an immutable audit log with timestamps. This log is retained for compliance review.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">6. Data Retention</h3>
                <p>Onboarding records are retained for the duration of the employment relationship and for 7 years thereafter, in compliance with applicable employment record-keeping regulations. Records may be deleted earlier upon written request to the engineering systems administrator.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">7. Contact</h3>
                <p>For privacy-related queries, contact your engineering systems administrator or data protection officer.</p>
              </section>
            </div>
          </div>
        )}

        {/* TERMS OF USE */}
        {activeTab === 'terms' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('workflow')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
              </button>
              <h2 className="text-lg font-bold text-white">Terms of Use</h2>
            </div>
            <p className="text-xs text-slate-500">Last updated: October 2026</p>

            <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-semibold text-white mb-2">1. Authorised Use</h3>
                <p>OnboardOS is an internal tool for use by authorised engineering and HR personnel only. Access is restricted to employees with appropriate system permissions. Unauthorised access or use is prohibited.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">2. AI-Assisted Decisions</h3>
                <p>Team assignment recommendations generated by the AI pipeline are advisory only. All placement decisions require explicit manager approval before taking effect. The system records both AI recommendations and manager decisions in the audit log.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">3. Data Accuracy</h3>
                <p>Personnel submitting candidate data are responsible for ensuring that information entered is accurate and complete. Knowingly submitting false information is a disciplinary matter.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">4. AI Limitations</h3>
                <p>Skill extraction, team scoring, and onboarding guide generation are performed using automated methods and may contain errors. Managers should review all outputs before acting on them. The system is a prototype and should not be the sole basis for employment decisions.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">5. Audit and Accountability</h3>
                <p>All actions taken within the system are logged with timestamps and actor identities. These logs may be reviewed by system administrators and management for compliance and quality assurance purposes.</p>
              </section>

              <section>
                <h3 className="font-semibold text-white mb-2">6. Changes to These Terms</h3>
                <p>These terms may be updated by the engineering systems administrator. Continued use of the system after notification of changes constitutes acceptance of the updated terms.</p>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <span>OnboardOS &mdash; Engineering Onboarding Orchestrator</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('privacy')}
              className="hover:text-slate-300 transition"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className="hover:text-slate-300 transition"
            >
              Terms of Use
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL: READABLE SKILL EVIDENCE & SIGNALS */}
      {skillEvidenceModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
                  <Award className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {skillEvidenceModal.skill}
                    {getLevelBadge(skillEvidenceModal.level)}
                  </h3>
                  <span className="text-xs text-slate-400 capitalize">Category: {skillEvidenceModal.category}</span>
                </div>
              </div>
              <button onClick={() => setSkillEvidenceModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics & Confidence */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Verification Status</span>
                <span className={`font-bold ${skillEvidenceModal.status === 'verified' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {skillEvidenceModal.status === 'verified' ? '✓ Verified by External Signals' : 'Claimed (Resume Only)'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Confidence Score</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-cyan-400 text-sm">
                    {Math.round((skillEvidenceModal.confidence || 0.8) * 100)}%
                  </span>
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-400 h-1.5 rounded-full"
                      style={{ width: `${(skillEvidenceModal.confidence || 0.8) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deterministic Signals Breakdown */}
            {skillEvidenceModal.signals_used && (
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="font-semibold text-slate-300 block">Deterministic Signals Evaluated:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div>Years Experience: <strong className="text-white">{skillEvidenceModal.signals_used.years_experience || 0} yrs</strong></div>
                  <div>Project Mentions: <strong className="text-white">{skillEvidenceModal.signals_used.project_mentions || 0} quotes</strong></div>
                  <div>GitHub Repos: <strong className="text-white">{skillEvidenceModal.signals_used.repo_count || 0} repos</strong></div>
                  <div>Certified: <strong className="text-white">{skillEvidenceModal.signals_used.certified ? 'Yes' : 'No'}</strong></div>
                </div>
                {skillEvidenceModal.signals_used.derivation && (
                  <div className="text-[11px] text-indigo-300 pt-1 border-t border-slate-900">
                    {skillEvidenceModal.signals_used.derivation.join(' • ')}
                  </div>
                )}
              </div>
            )}

            {/* Supporting Evidence Quotes */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-300 block">Evidence & Line Quotes:</span>
              <div className="space-y-1.5">
                {skillEvidenceModal.evidence?.map((ev, evIdx) => (
                  <div
                    key={evIdx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono leading-relaxed text-slate-300"
                  >
                    <span className="text-indigo-400 font-bold mr-1.5">›</span>
                    {ev}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSkillEvidenceModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW HIRE INTAKE */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                New Hire Onboarding Intake
              </h3>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDemoMode(!demoMode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                    demoMode
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                  }`}
                  title="Toggle developer hints & directory collision shortcuts"
                >
                  <FlaskConical className="w-3 h-3" />
                  <span>Dev mode: {demoMode ? 'on' : 'off'}</span>
                </button>
                <button onClick={() => setShowIntakeModal(false)} className="text-slate-400 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Developer Hints behind Demo Mode Toggle */}
            {demoMode && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Developer Collision Testing Shortcuts:</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  These names exist in the company directory to demonstrate identity conflict resolution:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, name: 'John Doe' }))}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg border border-amber-500/40 font-mono text-[11px] transition"
                  >
                    John Doe (jdoe collision)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, name: 'Alex Chen' }))}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg border border-amber-500/40 font-mono text-[11px] transition"
                  >
                    Alex Chen (achen collision)
                  </button>
                </div>
              </div>
            )}

            {/* Quick Load Prepared Sample Hire */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Load sample candidate:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadSampleHire('with_github')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium transition"
                >
                  Sample 1 — with GitHub
                </button>
                <button
                  type="button"
                  onClick={() => loadSampleHire('without_github')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium transition"
                >
                  Sample 2 — resume only
                </button>
              </div>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (intakeErrors.name) setIntakeErrors((prev) => ({ ...prev, name: null }));
                  }}
                  className={`w-full bg-slate-950 border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 ${
                    intakeErrors.name ? 'border-rose-500/80 bg-rose-500/5' : 'border-slate-700'
                  }`}
                />
                {intakeErrors.name && (
                  <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {intakeErrors.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      setFormData({ ...formData, role: e.target.value });
                      if (intakeErrors.role) setIntakeErrors((prev) => ({ ...prev, role: null }));
                    }}
                    className={`w-full bg-slate-950 border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 ${
                      intakeErrors.role ? 'border-rose-500/80 bg-rose-500/5' : 'border-slate-700'
                    }`}
                  >
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Data/ML">Data/ML</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Mobile">Mobile</option>
                  </select>
                  {intakeErrors.role && (
                    <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {intakeErrors.role}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Start Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      setFormData({ ...formData, startDate: e.target.value });
                      if (intakeErrors.startDate) setIntakeErrors((prev) => ({ ...prev, startDate: null }));
                    }}
                    className={`w-full bg-slate-950 border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 ${
                      intakeErrors.startDate ? 'border-rose-500/80 bg-rose-500/5' : 'border-slate-700'
                    }`}
                  />
                  {intakeErrors.startDate && (
                    <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {intakeErrors.startDate}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">
                    GitHub Username <span className="text-slate-500 font-normal text-[11px]">(optional, for repo verification)</span>
                  </label>
                  {isValidatingGithub && (
                    <span className="flex items-center gap-1 text-[11px] text-indigo-400">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Verifying profile...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. octocat (leave empty for resume-only)"
                    value={formData.githubUsername}
                    onBlur={() => checkGithubUsername(formData.githubUsername)}
                    onChange={(e) => {
                      setFormData({ ...formData, githubUsername: e.target.value });
                      setGithubCheckInfo(null);
                      if (intakeErrors.githubUsername) setIntakeErrors((prev) => ({ ...prev, githubUsername: null }));
                    }}
                    className={`w-full bg-slate-950 border rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600 ${
                      intakeErrors.githubUsername || githubCheckInfo?.status === 'not_found'
                        ? 'border-rose-500/80 bg-rose-500/5'
                        : githubCheckInfo?.status === 'valid'
                        ? 'border-emerald-500/60'
                        : 'border-slate-700'
                    }`}
                  />
                </div>
                {(intakeErrors.githubUsername || githubCheckInfo?.status === 'not_found') && (
                  <p className="text-rose-400 text-[11px] mt-1.5 flex items-center gap-1 font-medium animate-shake">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{intakeErrors.githubUsername || githubCheckInfo.message}</span>
                  </p>
                )}
                {githubCheckInfo?.status === 'valid' && (
                  <p className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>GitHub profile found: {githubCheckInfo.message}</span>
                  </p>
                )}
              </div>

              {/* Resume File Upload & Fallback */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold">
                    Resume Document <span className="text-slate-400 font-normal text-[11px]">(PDF, DOCX, or TXT)</span>
                  </label>
                  {resumeFileName && !resumeUploadError && (
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      <FileCheck className="w-3.5 h-3.5" />
                      {resumeFileName}
                    </span>
                  )}
                </div>

                <div className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-3 bg-slate-950/60 transition group text-center">
                  <input
                    type="file"
                    id="resume-file-input"
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleResumeFileUpload}
                    className="hidden"
                    disabled={uploadingResume}
                  />
                  <label
                    htmlFor="resume-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-1"
                  >
                    {uploadingResume ? (
                      <div className="flex items-center gap-2 text-indigo-400 text-xs py-1">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Parsing document on backend (pypdf/docx)...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-400">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-slate-300">
                          <span className="text-indigo-400 font-semibold underline underline-offset-2">Click to upload</span> or drag and drop
                        </div>
                        <p className="text-[10px] text-slate-500">Supports PDF, Word (.docx), or plain text (.txt)</p>
                      </>
                    )}
                  </label>
                </div>

                {/* Error Banner for Empty/Corrupt files */}
                {resumeUploadError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-400 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <strong className="font-semibold">Upload Error: </strong>
                      <span>{resumeUploadError}</span>
                      <p className="text-[11px] text-rose-300/80 mt-0.5">Please re-upload a valid file or paste your resume text in the fallback area below.</p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 font-medium">
                      Resume Text (Editable Fallback Preview) <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {formData.resumeText ? `${formData.resumeText.trim().length} chars (min 50)` : '0 chars'}
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={formData.resumeText}
                    onChange={(e) => {
                      setFormData({ ...formData, resumeText: e.target.value });
                      if (intakeErrors.resumeText) setIntakeErrors((prev) => ({ ...prev, resumeText: null }));
                    }}
                    placeholder="Paste or edit resume text here..."
                    className={`w-full bg-slate-950 border rounded-lg p-2.5 text-white font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 ${
                      intakeErrors.resumeText ? 'border-rose-500/80 bg-rose-500/5' : 'border-slate-700'
                    }`}
                  />
                  {intakeErrors.resumeText && (
                    <p className="text-rose-400 text-[11px] mt-1.5 flex items-center gap-1 font-medium animate-shake">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{intakeErrors.resumeText}</span>
                    </p>
                  )}
                </div>

                {/* Privacy Guardrail Note */}
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-slate-300 font-semibold">Privacy & Redaction Policy:</span>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      Candidate personal identifiers—phone numbers, physical addresses, personal emails, and dates of birth (DOB)—are automatically redacted locally before technical skill extraction and LLM ingestion.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  disabled={loading || isValidatingGithub}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isValidatingGithub || uploadingResume}
                  className="px-5 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Starting Agents...</span>
                    </>
                  ) : isValidatingGithub ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying GitHub...</span>
                    </>
                  ) : (
                    <span>Trigger Workflow</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CITATION SOURCE VIEW */}
      {citationModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Override Placement Decision</h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOverrideSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Team</label>
                <select
                  value={overrideData.team}
                  onChange={(e) => setOverrideData({ ...overrideData, team: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="Backend Platform">Backend Platform</option>
                  <option value="Frontend Platform">Frontend Platform</option>
                  <option value="Data & ML Platform">Data & ML Platform</option>
                  <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                  <option value="Mobile Platform">Mobile Platform</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Project</label>
                <input
                  type="text"
                  value={overrideData.project}
                  onChange={(e) => setOverrideData({ ...overrideData, project: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Manager Justification (Audited)</label>
                <textarea
                  rows={3}
                  required
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
