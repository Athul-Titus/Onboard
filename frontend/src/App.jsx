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
  FlaskConical,
  Trash2,
  Edit2,
  Users,
  Sparkles,
  Settings,
  Plus,
  RotateCw,
  Building2,
  Briefcase,
  Activity
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function App() {
  const [hires, setHires] = useState([]);
  const [selectedHireId, setSelectedHireId] = useState(null);
  const [hireDetail, setHireDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [citationModal, setCitationModal] = useState(null);
  const [skillEvidenceModal, setSkillEvidenceModal] = useState(null);
  const [activeTab, setActiveTab] = useState('workflow'); // 'workflow' | 'skills' | 'guide' | 'audit' | 'eval'
  const [retryingStep, setRetryingStep] = useState(null);
  const [evalData, setEvalData] = useState(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Email & Role Editing State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmailValue, setEditedEmailValue] = useState('');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editedRoleValue, setEditedRoleValue] = useState('');

  // Teams & Roles Directory State
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [teamsList, setTeamsList] = useState([]);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState(null);
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    required_skills: '',
    capacity: 5
  });

  // Team Roster & Placements State
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterData, setRosterData] = useState(null);
  const [rosterFilter, setRosterFilter] = useState('all');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Audit Log UI state
  const [auditAgentFilter, setAuditAgentFilter] = useState('all');
  const [auditTypeFilter, setAuditTypeFilter] = useState('all');
  const [expandedAuditLogs, setExpandedAuditLogs] = useState({});
  const [auditVerification, setAuditVerification] = useState(null);
  const [verifyingAudit, setVerifyingAudit] = useState(false);

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
Technical Skills: Python, FastAPI, Docker, Kubernetes, PostgreSQL, Redis, AWS, REST APIs, Git, Kafka, CI/CD.
Key Projects:
- Architected high-throughput ledger microservice in Python/FastAPI processing 20k events/sec with Redis caching (2022 - 2024).
- Optimized PostgreSQL database indexes and configured query connection pooling, cutting p99 latency by 65% (2021 - 2022).
- Implemented zero-downtime Kubernetes rolling deployment pipelines on AWS EKS with Prometheus monitoring (2019 - 2021).
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
- Spearheaded company-wide React component design system with 50+ accessible UI components used by 12 squads (2022 - 2024).
- Reduced initial bundle load size by 40% through code splitting, tree shaking, and modern asset optimizations (2020 - 2022).
- Built end-to-end testing infrastructure using Jest and Playwright with 95% critical path coverage (2018 - 2020).
Certifications: Meta Frontend Developer Professional Certificate, AWS Certified Cloud Practitioner.
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
        setSelectedHireId((prev) => {
          if (prev && data.some((h) => h.id === prev)) {
            return prev;
          }
          return data[0]?.id || null;
        });
      }
    } catch (err) {
      console.error('Error fetching hires:', err);
    }
  };

  // Delete a hire
  const handleDeleteHire = async (e, hireId) => {
    e.stopPropagation();
    if (!hireId) return;
    const target = hires.find((h) => h.id === hireId);
    const confirmName = target ? target.name : 'this hire';
    if (!window.confirm(`Delete onboarding record for ${confirmName}? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/hires/${hireId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = hires.filter((h) => h.id !== hireId);
        setHires(remaining);
        setSelectedHireId((prev) => (prev === hireId ? (remaining[0]?.id || null) : prev));
      }
    } catch (err) {
      console.error('Error deleting hire:', err);
    }
  };

  // Fetch detail for selected hire
  const fetchHireDetail = async (id, isSilent = false) => {
    if (!id) return;
    if (!isSilent && !hireDetail) setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/hires/${id}`);
      if (res.ok) {
        const data = await res.json();
        setHireDetail(data);
      }
    } catch (err) {
      console.error('Error fetching hire detail:', err);
    } finally {
      if (!isSilent) setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchHires();
    const interval = setInterval(fetchHires, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedHireId) {
      fetchHireDetail(selectedHireId, false);
      const detailInterval = setInterval(() => fetchHireDetail(selectedHireId, true), 3000);
      return () => clearInterval(detailInterval);
    } else {
      setHireDetail(null);
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

  // Retry a failed or needs_attention step
  const handleRetryStep = async (step) => {
    if (!selectedHireId) return;
    try {
      setRetryingStep(step);
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/retry/${step}`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchHireDetail(selectedHireId);
        await fetchHires();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Retry failed: ${err.detail || 'Could not retry step'}`);
      }
    } catch (err) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setRetryingStep(null);
    }
  };

  // Fetch benchmark evaluation metrics
  const fetchEvalData = async (force = false) => {
    try {
      setLoadingEval(true);
      const res = await fetch(`${API_BASE}/eval/benchmark${force ? '?force_refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setEvalData(data);
      }
    } catch (err) {
      console.error('Failed to load eval benchmarks:', err);
    } finally {
      setLoadingEval(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'eval' && !evalData) {
      fetchEvalData();
    }
  }, [activeTab]);

  // Clean duplicates and unwanted test runs
  const handleCleanDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE}/hires/clean-duplicates`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`Deduplication completed! Removed ${data.deleted_count} duplicate/unwanted runs. ${data.remaining_count} unique candidates active.`);
        await fetchHires();
      }
    } catch (err) {
      alert('Error cleaning duplicates: ' + err.message);
    }
  };

  // Fetch teams & roles directory
  const fetchTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeamsList(data);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  // Fetch team roster
  const fetchRoster = async () => {
    setLoadingRoster(true);
    try {
      const res = await fetch(`${API_BASE}/roster`);
      if (res.ok) {
        const data = await res.json();
        setRosterData(data);
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Save edited corporate email (before or after approval)
  const handleSaveEditedEmail = async () => {
    if (!selectedHireId || !editedEmailValue.trim()) return;
    try {
      const email = editedEmailValue.trim().toLowerCase();
      if (hireDetail?.identity?.status === 'waiting_approval') {
        await handleApproveStep('identity', email);
      } else {
        const res = await fetch(`${API_BASE}/hires/${selectedHireId}/identity/email`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            manager_name: 'Marcus Vance (Engineering Lead)'
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to update email');
        }
        await fetchHireDetail(selectedHireId);
        await fetchHires();
      }
      setIsEditingEmail(false);
    } catch (err) {
      alert('Error updating email: ' + err.message);
    }
  };

  // Save edited candidate role
  const handleSaveEditedRole = async () => {
    if (!selectedHireId || !editedRoleValue.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editedRoleValue.trim() })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update role');
      }
      setIsEditingRole(false);
      await fetchHireDetail(selectedHireId);
      await fetchHires();
    } catch (err) {
      alert('Error updating role: ' + err.message);
    }
  };

  // Recalculate deterministic placement
  const handleRecalculateAssignment = async () => {
    if (!selectedHireId) return;
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/recalculate-assignment`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchHireDetail(selectedHireId);
        await fetchHires();
        alert('Deterministic placement recalculated successfully!');
      }
    } catch (err) {
      alert('Error recalculating placement: ' + err.message);
    }
  };

  // Team directory management handlers
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamData.name.trim()) return;
    try {
      const skillsArray = newTeamData.required_skills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamData.name.trim(),
          description: newTeamData.description.trim(),
          required_skills: skillsArray,
          capacity: parseInt(newTeamData.capacity) || 5
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create team');
      }
      await fetchTeams();
      setIsAddingTeam(false);
      setNewTeamData({ name: '', description: '', required_skills: '', capacity: 5 });
    } catch (err) {
      alert('Error creating team: ' + err.message);
    }
  };

  const handleUpdateTeam = async (teamName, updatedPayload) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update team');
      }
      await fetchTeams();
      setEditingTeamIndex(null);
    } catch (err) {
      alert('Error updating team: ' + err.message);
    }
  };

  const handleDeleteTeam = async (teamName) => {
    if (!confirm(`Are you sure you want to delete the '${teamName}' team from the directory?`)) return;
    try {
      const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete team');
      }
      await fetchTeams();
    } catch (err) {
      alert('Error deleting team: ' + err.message);
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

  // Format readable timestamp
  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  // Format step duration
  const formatDuration = (ms) => {
    if (ms === undefined || ms === null || ms <= 0) return null;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Export audit log to formatted JSON file
  const handleExportAuditJson = () => {
    if (!hireDetail?.audit_logs) return;
    const jsonStr = JSON.stringify(hireDetail.audit_logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_log_${hireDetail.employee?.name?.toLowerCase().replace(/\s+/g, '_') || selectedHireId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Verify hash chain integrity against backend endpoint
  const handleVerifyAuditIntegrity = async () => {
    if (!selectedHireId) return;
    setVerifyingAudit(true);
    try {
      const res = await fetch(`${API_BASE}/hires/${selectedHireId}/audit/verify`);
      if (res.ok) {
        const data = await res.json();
        setAuditVerification(data);
      } else {
        setAuditVerification({
          valid: false,
          chain_status: 'ERROR',
          message: 'Failed to verify audit log integrity with server.'
        });
      }
    } catch (e) {
      setAuditVerification({
        valid: false,
        chain_status: 'ERROR',
        message: e.message
      });
    } finally {
      setVerifyingAudit(false);
    }
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

        <div className="flex items-center gap-2.5">
          {hires.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedHireId || ''}
                onChange={(e) => setSelectedHireId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[260px] truncate"
              >
                {hires.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} • {h.role} ({h.status})
                  </option>
                ))}
              </select>
              {selectedHireId && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteHire(e, selectedHireId)}
                  title="Delete this candidate record"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 border border-slate-700/60 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCleanDuplicates}
                title="Purge duplicate runs and broken test records"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700/60 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Clean Duplicates</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              fetchRoster();
              setShowRosterModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition shadow-sm"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Team Roster
          </button>

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
            Audit Log
          </button>
          <button
            onClick={() => setActiveTab('eval')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'eval'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            Evaluation Benchmarks
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
                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">Proposed Corporate Email:</span>
                        {!isEditingEmail && (
                          <button
                            onClick={() => {
                              setEditedEmailValue(hireDetail.identity.proposed_email);
                              setIsEditingEmail(true);
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium px-2 py-0.5 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
                          >
                            <Edit2 className="w-3 h-3" /> Edit Email
                          </button>
                        )}
                      </div>

                      {isEditingEmail ? (
                        <div className="mt-2 space-y-2.5">
                          <div>
                            <input
                              type="email"
                              value={editedEmailValue}
                              onChange={(e) => setEditedEmailValue(e.target.value)}
                              placeholder="e.g. firstname.lastname@company.com"
                              className="w-full bg-slate-900 border border-indigo-500 rounded-lg p-2 text-sm font-mono text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Recruiter custom email override. Format: <code className="text-indigo-400">username@company.com</code>
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setIsEditingEmail(false)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEditedEmail}
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {hireDetail.identity.status === 'waiting_approval' ? 'Save & Provision' : 'Update Email'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-base font-mono font-bold text-indigo-300 mt-0.5 flex items-center justify-between">
                            <span>{hireDetail.identity.proposed_email}</span>
                            {hireDetail.identity.account_created && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-sans font-semibold">
                                ✓ Provisioned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
                            <span>Rule: <code className="text-slate-200">{hireDetail.identity.rule_used}</code></span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              MOCK DIRECTORY
                            </span>
                          </div>
                        </>
                      )}
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
                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Approval Required
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditedEmailValue(hireDetail.identity.proposed_email);
                        setIsEditingEmail(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Email
                    </button>
                    <button
                      onClick={() => handleApproveStep('identity')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Suggested
                    </button>
                  </div>
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

                {/* Recruiter Controls: Candidate Target Role & Directory Management */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs text-slate-400">Target Role:</span>
                    {isEditingRole ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedRoleValue}
                          onChange={(e) => setEditedRoleValue(e.target.value)}
                          placeholder="e.g. Senior Backend Engineer"
                          className="bg-slate-900 border border-indigo-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button
                          onClick={handleSaveEditedRole}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditingRole(false)}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[11px] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {hireDetail?.employee?.role}
                        </span>
                        <button
                          onClick={() => {
                            setEditedRoleValue(hireDetail.employee.role);
                            setIsEditingRole(true);
                          }}
                          title="Edit Candidate Target Role"
                          className="text-xs text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-900 transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="text-[11px]">Edit Role</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleRecalculateAssignment}
                      title="Recalculate placement score using current candidate skills and updated team capacities"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                      Re-score
                    </button>
                    <button
                      onClick={() => {
                        fetchTeams();
                        setShowTeamsModal(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-indigo-400" />
                      Manage Teams & Roles
                    </button>
                    <button
                      onClick={() => {
                        fetchRoster();
                        setShowRosterModal(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 transition"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      Assigned Roster
                    </button>
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

                            {/* Score Breakdown Bars for all 4 deterministic components */}
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
                                  <span>Gap Coverage (25%)</span>
                                  <span>{Math.round(cand.score_breakdown.gap_coverage * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${cand.score_breakdown.gap_coverage * 100}%` }}></div>
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

                              <div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Learning Gap (-15%)</span>
                                  <span>{Math.round(cand.score_breakdown.learning_gap * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                  <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${cand.score_breakdown.learning_gap * 100}%` }}></div>
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
                    : hireDetail.skill_map.verification_state === 'GitHub unavailable'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  <GitBranch className="w-3.5 h-3.5" />
                  {hireDetail.skill_map.verification_state === 'verified'
                    ? 'GitHub Verified'
                    : hireDetail.skill_map.verification_state === 'GitHub unavailable'
                    ? 'GitHub Unavailable'
                    : 'Resume-Only'}
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
                {Object.entries(hireDetail.skill_map?.gaps_by_team || {}).map(([teamName, gapData]) => {
                  const matched = gapData.matched_skills || [];
                  const missing = gapData.missing_skills || [];
                  const totalReq = gapData.required_skills?.length || (matched.length + missing.length);
                  const coverage = gapData.coverage_percent !== undefined && gapData.coverage_percent !== null
                    ? gapData.coverage_percent
                    : (totalReq > 0 ? Math.round((matched.length / totalReq) * 100) : 0);
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
                          {matched.length} matched / {totalReq} required
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
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base">Personalised 30-Day Engineering Guide</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every step is grounded in internal engineering documentation. Missing policies are explicitly flagged.
                  {hireDetail?.guide?.total_count > 0 && (
                    <span className="ml-1">
                      Sources verified: <strong className="text-slate-300">{hireDetail.guide.verified_count}/{hireDetail.guide.total_count}</strong>.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hireDetail?.guide?.total_count > 0 ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border ${
                    hireDetail.guide.verified_count === hireDetail.guide.total_count
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border-amber-800'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {hireDetail.guide.verified_count}/{hireDetail.guide.total_count} Citations Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border bg-slate-800 text-slate-400 border-slate-700">
                    <Clock className="w-3.5 h-3.5" /> Awaiting Generation
                  </span>
                )}
              </div>
            </div>

            {hireDetail?.guide ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {hireDetail.guide.sections.map((sec, idx) => (
                  <div key={idx} className={`bg-slate-900 border border-slate-800 rounded-lg p-5 ${
                    sec.title === 'Overview' ? 'md:col-span-2' : ''
                  }`}>
                    <h4 className="font-bold text-white text-sm pb-2 border-b border-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-indigo-500 rounded-sm inline-block shrink-0"></span>
                      {sec.title}
                    </h4>

                    <div className="space-y-2.5">
                      {sec.items.map((item, itemIdx) => {
                        const isNotDoc = item.status === 'not_documented' || !item.citation;
                        return (
                          <div
                            key={itemIdx}
                            className={`p-3 rounded border text-xs leading-relaxed ${
                              isNotDoc
                                ? 'bg-amber-950/20 border-amber-800/40'
                                : 'bg-slate-950/60 border-slate-800'
                            }`}
                          >
                            {/* Actionable instruction */}
                            <p className={`font-medium mb-1 ${isNotDoc ? 'text-amber-300' : 'text-slate-200'}`}>
                              {item.text}
                            </p>
                            {/* Optional detail */}
                            {item.detail && (
                              <p className="text-slate-400 text-[11px] mb-1.5 leading-snug">
                                {item.detail}
                              </p>
                            )}
                            {/* Citation or guardrail badge */}
                            {item.citation ? (
                              <button
                                onClick={() => setCitationModal({
                                  ...item.citation,
                                  source_text: item.citation.source_text
                                })}
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 hover:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/50 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {item.citation.doc} § {item.citation.section}
                              </button>
                            ) : (
                              <span className="mt-1 inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/60">
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
              <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-lg">
                <BookOpen className="w-8 h-8 mx-auto mb-3 text-slate-700" />
                <p className="text-sm">Guide generation in progress...</p>
                <p className="text-xs text-slate-600 mt-1">The guide runs after team assignment is approved.</p>
              </div>
            )}
          </div>
        )}


        {/* TAB 4: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            {/* Header & Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Audit Log
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only cryptographic audit trail recording tool invocations, agent steps, manager actions, and failure recovery.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerifyAuditIntegrity}
                  disabled={verifyingAudit || !selectedHireId}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Verify SHA-256 cryptographic hash chain integrity"
                >
                  {verifyingAudit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  Verify Integrity
                </button>

                <button
                  onClick={handleExportAuditJson}
                  disabled={!hireDetail?.audit_logs?.length}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Export audit trail entries as JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>

                <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                  {hireDetail?.audit_logs?.length || 0} Events
                </span>
              </div>
            </div>

            {/* Verification Status Banner */}
            {auditVerification && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                  auditVerification.valid
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {auditVerification.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {auditVerification.valid
                        ? 'Cryptographic Hash Chain Verified (INTACT)'
                        : 'Audit Log Integrity Compromised!'}
                    </span>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {auditVerification.message} (Verified {auditVerification.total_entries} blocks)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAuditVerification(null)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Agent:</span>
                  <select
                    value={auditAgentFilter}
                    onChange={(e) => setAuditAgentFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Agents ({hireDetail?.audit_logs?.length || 0})</option>
                    {Array.from(new Set(hireDetail?.audit_logs?.map((l) => l.agent) || [])).map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Event Type:</span>
                  <select
                    value={auditTypeFilter}
                    onChange={(e) => setAuditTypeFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Event Types</option>
                    <option value="tool_invocation">Tool Invocations</option>
                    <option value="manager_action">Manager Actions</option>
                    <option value="agent_step">Agent Steps</option>
                    <option value="failure_recovery">Failure & Recovery</option>
                  </select>
                </div>

                {(auditAgentFilter !== 'all' || auditTypeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setAuditAgentFilter('all');
                      setAuditTypeFilter('all');
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <span className="text-slate-500 text-[11px]">
                Showing{' '}
                {
                  (hireDetail?.audit_logs || []).filter((log) => {
                    const matchesAgent = auditAgentFilter === 'all' || log.agent === auditAgentFilter;
                    const matchesType = auditTypeFilter === 'all' || (log.entry_type || 'agent_step') === auditTypeFilter;
                    return matchesAgent && matchesType;
                  }).length
                }{' '}
                of {hireDetail?.audit_logs?.length || 0} entries
              </span>
            </div>

            {/* Event List */}
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {(hireDetail?.audit_logs || [])
                .filter((log) => {
                  const matchesAgent = auditAgentFilter === 'all' || log.agent === auditAgentFilter;
                  const matchesType = auditTypeFilter === 'all' || (log.entry_type || 'agent_step') === auditTypeFilter;
                  return matchesAgent && matchesType;
                })
                .map((log, idx) => {
                  const logKey = log.id || `${log.timestamp}-${idx}`;
                  const isExpanded = Boolean(expandedAuditLogs[logKey]);
                  const isLongReason = log.reason && log.reason.length > 180;
                  const formattedDuration = formatDuration(log.duration_ms);

                  // Badge config based on entry_type
                  let typeBadge = (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                      Agent Step
                    </span>
                  );
                  if (log.entry_type === 'tool_invocation') {
                    typeBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                        Tool Call
                      </span>
                    );
                  } else if (log.entry_type === 'manager_action') {
                    typeBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                        Manager Action
                      </span>
                    );
                  } else if (log.entry_type === 'failure_recovery') {
                    typeBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                        Failure & Recovery
                      </span>
                    );
                  }

                  return (
                    <div
                      key={logKey}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2.5 text-xs hover:border-slate-700 transition"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-indigo-400">{log.agent}</span>
                          <span className="text-slate-500 font-mono text-[11px]">› {log.action}</span>
                          {typeBadge}
                          {log.actor && log.actor !== 'System' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              Actor: {log.actor}
                            </span>
                          )}
                          {formattedDuration && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formattedDuration}
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-[11px] text-slate-400" title={log.timestamp}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>

                      {/* Input Summary */}
                      <div className="text-slate-300 bg-slate-900/40 p-2.5 rounded border border-slate-800/60">
                        <strong className="text-slate-400 font-medium mr-1.5">Input:</strong>
                        <span className="font-mono text-slate-300 text-[11px] break-all">{log.input_summary}</span>
                      </div>

                      {/* Output Summary */}
                      <div className="text-slate-300 bg-slate-900/40 p-2.5 rounded border border-slate-800/60">
                        <strong className="text-slate-400 font-medium mr-1.5">Output:</strong>
                        <span className="text-slate-200 leading-relaxed">{log.output_summary}</span>
                      </div>

                      {/* Expandable Rationale (no truncation) */}
                      <div className="bg-slate-900/30 p-2.5 rounded border border-slate-800/40 text-slate-300">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <strong className="text-indigo-300 font-medium mr-1.5">Rationale:</strong>
                            <span className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {isExpanded || !isLongReason ? log.reason : `${log.reason.slice(0, 180)}...`}
                            </span>
                          </div>
                          {isLongReason && (
                            <button
                              onClick={() =>
                                setExpandedAuditLogs((prev) => ({
                                  ...prev,
                                  [logKey]: !prev[logKey],
                                }))
                              }
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-semibold shrink-0 cursor-pointer ml-2"
                            >
                              {isExpanded ? 'Collapse' : 'Expand full rationale'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cryptographic Hash Chain Footer */}
                      {(log.entry_hash || log.previous_hash) && (
                        <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 gap-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span title={log.previous_hash || 'Genesis'}>
                              <span className="text-slate-600">PREV:</span>{' '}
                              <span className="text-slate-400">
                                {log.previous_hash ? `${log.previous_hash.slice(0, 14)}...` : '000000000000... (GENESIS)'}
                              </span>
                            </span>
                            <span title={log.entry_hash || 'Unhashed'}>
                              <span className="text-slate-600">HASH:</span>{' '}
                              <span className="text-slate-400">
                                {log.entry_hash ? `${log.entry_hash.slice(0, 14)}...` : 'UNHASHED'}
                              </span>
                            </span>
                          </div>
                          <span className="text-emerald-500/80 font-sans text-[10px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Append-Only
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

              {(hireDetail?.audit_logs || []).length === 0 && (
                <div className="p-8 text-center text-slate-500 bg-slate-950 border border-slate-800 rounded-lg">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p>No audit log events recorded for this hire yet.</p>
                </div>
              )}
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
                    placeholder="GitHub username (optional, leave blank for resume-only)"
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
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Source Documentation
              </h3>
              <button onClick={() => setCitationModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-0.5">Document</span>
                  <strong className="text-indigo-400 font-mono">{citationModal.doc}</strong>
                </div>
                <div>
                  <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-0.5">Section</span>
                  <strong className="text-slate-200">{citationModal.section}</strong>
                </div>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1.5">Source Text</span>
                {citationModal.source_text ? (
                  <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-72 overflow-y-auto">
                    {citationModal.source_text}
                  </pre>
                ) : (
                  <p className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-400 italic">
                    Citation verified in knowledge store — source text not yet cached. Run a new intake to populate it.
                  </p>
                )}
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

      {/* Team Roster & Placements Modal */}
      {showRosterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Company Team Roster & Engineering Placements
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                      Live Directory
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time overview of engineers, squad capacities, starter projects, and candidate pipeline status.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchRoster}
                  disabled={loadingRoster}
                  title="Refresh Roster"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <RotateCw className={`w-4 h-4 ${loadingRoster ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowRosterModal(false)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total Hires:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-bold">
                    {rosterData?.total_hires ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Assigned Engineers:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    {rosterData?.total_assigned ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Unassigned / Pending:</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                    {rosterData?.total_unassigned ?? 0}
                  </span>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
                <button
                  onClick={() => setRosterFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    rosterFilter === 'all'
                      ? 'bg-indigo-600 text-white font-medium shadow-md'
                      : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  All Teams ({rosterData?.teams?.length || 0})
                </button>
                {rosterData?.teams?.map((t) => (
                  <button
                    key={t.team_name}
                    onClick={() => setRosterFilter(t.team_name)}
                    className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                      rosterFilter === t.team_name
                        ? 'bg-indigo-600 text-white font-medium shadow-md'
                        : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {t.team_name} ({t.current_load}/{t.capacity})
                  </button>
                ))}
                {rosterData?.unassigned?.length > 0 && (
                  <button
                    onClick={() => setRosterFilter('unassigned')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      rosterFilter === 'unassigned'
                        ? 'bg-amber-600 text-white font-medium shadow-md'
                        : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
                    }`}
                  >
                    Unassigned ({rosterData.unassigned.length})
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body / Scrollable Teams & Members */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/50">
              {loadingRoster ? (
                <div className="py-16 text-center">
                  <RotateCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Loading company team roster...</p>
                </div>
              ) : (
                <>
                  {/* Filtered Team Cards */}
                  {rosterData?.teams
                    ?.filter((t) => rosterFilter === 'all' || rosterFilter === t.team_name)
                    ?.map((team) => {
                      const loadPct = Math.min(100, Math.round((team.current_load / (team.capacity || 1)) * 100));
                      return (
                        <div
                          key={team.team_name}
                          className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 hover:border-slate-700 transition-all"
                        >
                          {/* Team Card Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <Building2 className="w-5 h-5 text-indigo-400" />
                                <h4 className="text-base font-semibold text-white">{team.team_name}</h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                  {team.assigned_members?.length || 0} assigned
                                </span>
                              </div>
                              {/* Skills */}
                              {team.required_skills?.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <span className="text-[11px] text-slate-500">Required Skills:</span>
                                  {team.required_skills.map((skill) => (
                                    <span
                                      key={skill}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/60 font-mono"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Capacity Bar */}
                            <div className="sm:text-right min-w-[180px]">
                              <div className="flex items-center sm:justify-end gap-2 text-xs mb-1">
                                <span className="text-slate-400">Capacity:</span>
                                <span className="font-semibold text-slate-200">
                                  {team.current_load} / {team.capacity}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  ({team.available_slots} slots left)
                                </span>
                              </div>
                              <div className="w-full sm:w-44 h-2 bg-slate-800 rounded-full overflow-hidden ml-auto">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    loadPct >= 90
                                      ? 'bg-rose-500'
                                      : loadPct >= 60
                                      ? 'bg-amber-400'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${loadPct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Assigned Members Grid */}
                          <div className="mt-4">
                            {team.assigned_members?.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {team.assigned_members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900/90 transition-all group flex flex-col justify-between"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="font-semibold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                                            {member.name}
                                          </p>
                                          <p className="text-xs text-slate-400 truncate mt-0.5">
                                            {member.role || 'Software Engineer'}
                                          </p>
                                        </div>
                                        <span
                                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                            member.status === 'done'
                                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                              : member.status === 'needs_attention'
                                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                          }`}
                                        >
                                          {member.status}
                                        </span>
                                      </div>

                                      {/* Email handle */}
                                      {member.email && (
                                        <div className="mt-2 text-xs font-mono text-cyan-400/90 truncate flex items-center gap-1">
                                          <span className="text-slate-600">@</span>
                                          {member.email}
                                        </div>
                                      )}

                                      {/* Starter Project */}
                                      {member.starter_project && (
                                        <div className="mt-2 text-[11px] text-slate-400 bg-slate-950/70 px-2 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                                          <Briefcase className="w-3 h-3 text-indigo-400 shrink-0" />
                                          <span className="truncate">{member.starter_project}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action button */}
                                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-end">
                                      <button
                                        onClick={() => {
                                          setSelectedHireId(member.id);
                                          setShowRosterModal(false);
                                        }}
                                        className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                                      >
                                        Inspect Profile →
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic py-2">
                                No engineers currently assigned to this team.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {/* Unassigned Candidates Section */}
                  {(rosterFilter === 'all' || rosterFilter === 'unassigned') &&
                    rosterData?.unassigned?.length > 0 && (
                      <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                            <h4 className="text-base font-semibold text-amber-300">
                              Unassigned / In-Flight Candidates
                            </h4>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {rosterData.unassigned.length} candidates
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                          {rosterData.unassigned.map((cand) => (
                            <div
                              key={cand.id}
                              className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-amber-500/40 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-sm text-slate-200">{cand.name}</p>
                                <p className="text-xs text-slate-400">{cand.role}</p>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 mt-1 inline-block">
                                  Status: {cand.status}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedHireId(cand.id);
                                  setShowRosterModal(false);
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                              >
                                View Pipeline
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Click &quot;Inspect Profile&quot; on any engineer to view their complete skills radar, audit trail, and onboarding plan.
              </span>
              <button
                onClick={() => setShowRosterModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recruiter Team & Role Directory Management Modal */}
      {showTeamsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Recruiter Engineering Roles & Teams Directory
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                      Recruiter Hub
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Add new engineering teams, customize required skill sets, and balance headcounts for automated matching.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTeamsModal(false);
                  setIsAddingTeam(false);
                  setEditingTeamIndex(null);
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Bar */}
            <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Active Teams & Squads: <span className="font-semibold text-slate-200">{teamsList.length}</span>
              </p>
              <button
                onClick={() => setIsAddingTeam(!isAddingTeam)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingTeam ? 'Cancel New Team' : 'Add New Team / Role'}
              </button>
            </div>

            {/* Add New Team Form (collapsible) */}
            {isAddingTeam && (
              <form onSubmit={handleCreateTeam} className="p-5 bg-indigo-950/20 border-b border-indigo-500/30">
                <h4 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add New Squad or Role Definition
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Team Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AI Platform, Core Infrastructure"
                      value={newTeamData.name}
                      onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Target Capacity (Seats)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={newTeamData.capacity}
                      onChange={(e) => setNewTeamData({ ...newTeamData, capacity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Required Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Python, PyTorch, Kubernetes, MLOps, Docker"
                      value={newTeamData.required_skills}
                      onChange={(e) => setNewTeamData({ ...newTeamData, required_skills: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Squad Mission & Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief description of the squad responsibilities and starter challenges..."
                      value={newTeamData.description}
                      onChange={(e) => setNewTeamData({ ...newTeamData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingTeam(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    Save Team
                  </button>
                </div>
              </form>
            )}

            {/* Teams List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {teamsList.map((team, idx) => {
                const isEditing = editingTeamIndex === idx;
                return (
                  <div
                    key={team.name}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all"
                  >
                    {isEditing ? (
                      /* Inline Team Editor */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-indigo-400">Editing: {team.name}</h4>
                          <span className="text-xs text-slate-500 font-mono">Current load: {team.current_load}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Capacity</label>
                            <input
                              type="number"
                              min="1"
                              defaultValue={team.capacity}
                              id={`edit-capacity-${idx}`}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[11px] text-slate-400 mb-1">Required Skills (comma-separated)</label>
                            <input
                              type="text"
                              defaultValue={team.required_skills?.join(', ') || ''}
                              id={`edit-skills-${idx}`}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                          <textarea
                            rows={2}
                            defaultValue={team.description || ''}
                            id={`edit-desc-${idx}`}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingTeamIndex(null)}
                            className="px-3 py-1 text-xs rounded bg-slate-800 text-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const capacity = parseInt(document.getElementById(`edit-capacity-${idx}`).value) || team.capacity;
                              const skills = document.getElementById(`edit-skills-${idx}`).value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const description = document.getElementById(`edit-desc-${idx}`).value;
                              handleUpdateTeam(team.name, { capacity, required_skills: skills, description });
                            }}
                            className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Team Card */
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-semibold text-white">{team.name}</h4>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                Capacity: {team.current_load} / {team.capacity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{team.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingTeamIndex(idx)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.name)}
                              className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Skill Badges */}
                        {team.required_skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/80">
                            {team.required_skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800 font-mono"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Updating team capacities and required skill profiles updates the Project Management matching engine immediately.
              </span>
              <button
                onClick={() => {
                  setShowTeamsModal(false);
                  setIsAddingTeam(false);
                  setEditingTeamIndex(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
