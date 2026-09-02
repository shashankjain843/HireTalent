"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  bulkImportEmployees,
  createEmployee,
  listEmployees,
  listSkillConfigs,
  updateEmployee,
} from "../../../lib/adminApi";
import type {
  EmployeeLifecycleStatus,
  EmployeeProfileResponse,
  SkillConfigResponse,
} from "../../../lib/adminTypes";

type TalentPool = "Full-Stack" | "DevOps" | "Product Management" | "Data";
type LifecycleStatus = EmployeeLifecycleStatus;

const DEPARTMENT_STYLES: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-700",
  Product: "bg-violet-100 text-violet-700",
  Design: "bg-pink-100 text-pink-700",
  Operations: "bg-amber-100 text-amber-700",
  HR: "bg-emerald-100 text-emerald-700",
};

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeProfileResponse[]>([]);
  const [skillConfigs, setSkillConfigs] = useState<SkillConfigResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeProfileResponse | null>(null);
  const [quickEditEmployeeId, setQuickEditEmployeeId] = useState<string | null>(null);
  const [quickEditDraft, setQuickEditDraft] = useState({
    lifecycleStatus: "Active Employee" as LifecycleStatus,
    talentPool: "Full-Stack" as TalentPool,
    selectedExpertise: [] as string[],
  });
  const [bulkImportInput, setBulkImportInput] = useState(
    "name,email,title,department",
  );
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [expertiseFilter, setExpertiseFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [addEmployeeMode, setAddEmployeeMode] = useState<"new" | "existing">("new");
  const [selectedExistingEmployeeId, setSelectedExistingEmployeeId] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    department: "",
    bio: "",
    registerAsCandidate: false,
    talentPool: "Full-Stack" as TalentPool,
    selectedExpertise: [] as string[],
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    resumeUrl: "",
    currentLocation: "",
    availabilityStatus: "2 Weeks",
    yearsOfExperience: "",
    candidateNotes: "",
    sendInviteEmail: true,
  });
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    title: "",
    department: "",
    bio: "",
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    resumeUrl: "",
    currentLocation: "",
    availabilityStatus: "2 Weeks",
    yearsOfExperience: "",
    candidateNotes: "",
    registerAsCandidate: false,
    talentPool: "Full-Stack" as TalentPool,
    selectedExpertise: [] as string[],
    lifecycleStatus: "Active Employee" as LifecycleStatus,
    sendInviteEmail: false,
  });

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {});
    listSkillConfigs().then(setSkillConfigs).catch(() => {});
  }, []);

  const availableSkills = useMemo(
    () =>
      skillConfigs
        .filter((cfg) => cfg.is_enabled)
        .map((cfg) => cfg.template_name ?? cfg.template_id),
    [skillConfigs],
  );

  const uniqueDepartments = useMemo(() => {
    return Array.from(
      new Set(employees.map((emp) => emp.department).filter(Boolean)),
    ) as string[];
  }, [employees]);

  const getLifecycle = (emp: EmployeeProfileResponse): LifecycleStatus => {
    return emp.lifecycle_status;
  };

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      const lifecycle = getLifecycle(emp);
      const expertise = emp.expertise ?? [];
      const matchesDepartment =
        departmentFilter === "all" || emp.department === departmentFilter;
      const matchesExpertise =
        expertiseFilter === "all" || expertise.includes(expertiseFilter);
      const matchesLifecycle =
        lifecycleFilter === "all" || lifecycle === lifecycleFilter;
      const matchesSearch =
        q.length === 0 ||
        emp.name.toLowerCase().includes(q) ||
        (emp.email ?? "").toLowerCase().includes(q) ||
        (emp.title ?? "").toLowerCase().includes(q);
      return (
        matchesDepartment &&
        matchesExpertise &&
        matchesLifecycle &&
        matchesSearch
      );
    });
  }, [
    employees,
    departmentFilter,
    expertiseFilter,
    lifecycleFilter,
    searchQuery,
  ]);
  const hasActiveFilters =
    departmentFilter !== "all" ||
    expertiseFilter !== "all" ||
    lifecycleFilter !== "all" ||
    searchQuery.trim().length > 0;

  const totalEmployees = employees.length;
  const activeCandidates = employees.filter(
    (emp) => emp.is_internal_candidate,
  ).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (addEmployeeMode === "existing" && !selectedExistingEmployeeId) {
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email || undefined,
        title: form.title || undefined,
        department: form.department || undefined,
        bio: form.bio || undefined,
        github_url: form.githubUrl || undefined,
        linkedin_url: form.linkedinUrl || undefined,
        portfolio_url: form.portfolioUrl || undefined,
        resume_url: form.resumeUrl || undefined,
        current_location: form.currentLocation || undefined,
        availability_status: form.availabilityStatus || undefined,
        years_of_experience: form.yearsOfExperience
          ? Number(form.yearsOfExperience)
          : undefined,
        candidate_notes: form.candidateNotes || undefined,
        is_internal_candidate: form.registerAsCandidate,
        talent_pool: form.registerAsCandidate ? form.talentPool : undefined,
        expertise: form.selectedExpertise,
        lifecycle_status: form.registerAsCandidate
          ? ("Internal Candidate" as LifecycleStatus)
          : ("Active Employee" as LifecycleStatus),
        send_invite_email: form.sendInviteEmail,
      };
      if (addEmployeeMode === "existing") {
        const updated = await updateEmployee(selectedExistingEmployeeId, payload);
        setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      } else {
        const emp = await createEmployee(payload);
        setEmployees([...employees, emp]);
      }
      if (addEmployeeMode === "existing") {
        setInviteMessage("Existing employee updated successfully.");
      } else if (form.sendInviteEmail && form.email) {
        setInviteMessage(`Invitation queued for ${form.email}`);
      } else {
        setInviteMessage("Employee added successfully.");
      }
      setShowForm(false);
      setAddEmployeeMode("new");
      setSelectedExistingEmployeeId("");
      setForm({
        name: "",
        email: "",
        title: "",
        department: "",
        bio: "",
        registerAsCandidate: false,
        talentPool: "Full-Stack",
        selectedExpertise: [],
        githubUrl: "",
        linkedinUrl: "",
        portfolioUrl: "",
        resumeUrl: "",
        currentLocation: "",
        availabilityStatus: "2 Weeks",
        yearsOfExperience: "",
        candidateNotes: "",
        sendInviteEmail: true,
      });
    } catch {}
    setLoading(false);
  }

  function loadExistingEmployeeIntoForm(employeeId: string) {
    const existing = employees.find((emp) => emp.id === employeeId);
    if (!existing) return;
    setSelectedExistingEmployeeId(employeeId);
    setForm({
      name: existing.name ?? "",
      email: existing.email ?? "",
      title: existing.title ?? "",
      department: existing.department ?? "",
      bio: existing.bio ?? "",
      registerAsCandidate: existing.is_internal_candidate,
      talentPool: (existing.talent_pool as TalentPool) ?? "Full-Stack",
      selectedExpertise: existing.expertise ?? [],
      githubUrl: existing.github_url ?? "",
      linkedinUrl: existing.linkedin_url ?? "",
      portfolioUrl: existing.portfolio_url ?? "",
      resumeUrl: existing.resume_url ?? "",
      currentLocation: existing.current_location ?? "",
      availabilityStatus: existing.availability_status ?? "2 Weeks",
      yearsOfExperience:
        existing.years_of_experience == null ? "" : String(existing.years_of_experience),
      candidateNotes: existing.candidate_notes ?? "",
      sendInviteEmail: false,
    });
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkImportInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) return;

    const payload = lines.slice(1).map((line) => {
      const [name, email, title, department] = line.split(",").map((v) => v.trim());
      return { name, email, title, department };
    });

    setLoading(true);
    try {
      const imported = await bulkImportEmployees(payload);
      setEmployees((prev) => [...prev, ...imported]);
      setShowBulkImport(false);
    } catch {}
    setLoading(false);
  }

  function toggleExpertiseSelection(skill: string) {
    setForm((prev) => ({
      ...prev,
      selectedExpertise: prev.selectedExpertise.includes(skill)
        ? prev.selectedExpertise.filter((s) => s !== skill)
        : [...prev.selectedExpertise, skill],
    }));
  }

  async function toggleActive(emp: EmployeeProfileResponse) {
    const updated = await updateEmployee(emp.id, { is_active: !emp.is_active });
    setEmployees(employees.map((e) => (e.id === emp.id ? updated : e)));
  }

  function openQuickEdit(emp: EmployeeProfileResponse) {
    setQuickEditEmployeeId(emp.id);
    setQuickEditDraft({
      lifecycleStatus: emp.lifecycle_status,
      talentPool: (emp.talent_pool as TalentPool) ?? "Full-Stack",
      selectedExpertise: emp.expertise ?? [],
    });
  }

  async function saveQuickEdit(emp: EmployeeProfileResponse) {
    setLoading(true);
    try {
      const shouldBeActive = quickEditDraft.lifecycleStatus !== "Inactive";
      const updated = await updateEmployee(emp.id, {
        lifecycle_status: quickEditDraft.lifecycleStatus,
        is_internal_candidate: quickEditDraft.lifecycleStatus === "Internal Candidate",
        talent_pool:
          quickEditDraft.lifecycleStatus === "Internal Candidate"
            ? quickEditDraft.talentPool
            : undefined,
        expertise: quickEditDraft.selectedExpertise,
        is_active: shouldBeActive,
      });
      setEmployees((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setQuickEditEmployeeId(null);
    } catch {}
    setLoading(false);
  }

  function openEditModal(emp: EmployeeProfileResponse) {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name,
      email: emp.email ?? "",
      title: emp.title ?? "",
      department: emp.department ?? "",
      bio: emp.bio ?? "",
      githubUrl: emp.github_url ?? "",
      linkedinUrl: emp.linkedin_url ?? "",
      portfolioUrl: emp.portfolio_url ?? "",
      resumeUrl: emp.resume_url ?? "",
      currentLocation: emp.current_location ?? "",
      availabilityStatus: emp.availability_status ?? "2 Weeks",
      yearsOfExperience:
        emp.years_of_experience == null ? "" : String(emp.years_of_experience),
      candidateNotes: emp.candidate_notes ?? "",
      registerAsCandidate: emp.is_internal_candidate,
      talentPool: (emp.talent_pool as TalentPool) ?? "Full-Stack",
      selectedExpertise: emp.expertise ?? [],
      lifecycleStatus: emp.lifecycle_status,
      sendInviteEmail: false,
    });
  }

  async function handleUpdateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setLoading(true);
    try {
      const shouldBeActive = editForm.lifecycleStatus !== "Inactive";
      const updated = await updateEmployee(editingEmployee.id, {
        name: editForm.name,
        email: editForm.email || undefined,
        title: editForm.title || undefined,
        department: editForm.department || undefined,
        bio: editForm.bio || undefined,
        github_url: editForm.githubUrl || undefined,
        linkedin_url: editForm.linkedinUrl || undefined,
        portfolio_url: editForm.portfolioUrl || undefined,
        resume_url: editForm.resumeUrl || undefined,
        current_location: editForm.currentLocation || undefined,
        availability_status: editForm.availabilityStatus || undefined,
        years_of_experience: editForm.yearsOfExperience
          ? Number(editForm.yearsOfExperience)
          : undefined,
        candidate_notes: editForm.candidateNotes || undefined,
        is_internal_candidate:
          editForm.lifecycleStatus === "Internal Candidate" ||
          editForm.registerAsCandidate,
        talent_pool:
          editForm.lifecycleStatus === "Internal Candidate" ||
          editForm.registerAsCandidate
            ? editForm.talentPool
            : undefined,
        expertise: editForm.selectedExpertise,
        lifecycle_status: editForm.lifecycleStatus,
        is_active: shouldBeActive,
        send_invite_email: editForm.sendInviteEmail,
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      setEditingEmployee(null);
    } catch {}
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Employee Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage team members, internal talent pools, and lifecycle status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkImport(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Bulk Import
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Add Employee
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-indigo-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Total Employees
            </p>
            <p className="mt-1 text-2xl font-semibold text-indigo-900">
              {totalEmployees}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              Active Candidates
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">
              {activeCandidates}
            </p>
          </div>
          <div className="rounded-lg bg-violet-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
              Departments
            </p>
            <p className="mt-1 text-2xl font-semibold text-violet-900">
              {uniqueDepartments.length}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
              Skills Mapped
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">
              {availableSkills.length}
            </p>
          </div>
        </div>
        {inviteMessage && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {inviteMessage}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase text-gray-500">
                Search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, email, role"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase text-gray-500">
                Department
              </span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase text-gray-500">
                Expertise
              </span>
              <select
                value={expertiseFilter}
                onChange={(e) => setExpertiseFilter(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Expertise</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase text-gray-500">
                Lifecycle
              </span>
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active Employee">Active Employee</option>
                <option value="Internal Candidate">Internal Candidate</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>
        </aside>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          {filteredEmployees.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                +
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {hasActiveFilters
                  ? "No employees match current filters"
                  : "Build your employee roster"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {hasActiveFilters
                  ? "Try clearing one or more filters to view your employees."
                  : "Add employees individually or import your list in bulk to start lifecycle tracking and talent-pool mapping."}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepartmentFilter("all");
                      setExpertiseFilter("all");
                      setLifecycleFilter("all");
                      setSearchQuery("");
                    }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  onClick={() => setShowForm(true)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Add Employee
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Bulk Import
                </button>
              </div>
            </div>
          ) : (
            <table className="min-w-[980px] w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Candidate Snapshot
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Expertise
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Talent Pool
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    Lifecycle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => {
                  const lifecycle = getLifecycle(emp);
                  const dept = emp.department ?? "General";
                  const deptClass = DEPARTMENT_STYLES[dept] ?? "bg-gray-100 text-gray-700";
                  return (
                    <Fragment key={emp.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {emp.avatar_url ? (
                              <img
                                src={emp.avatar_url}
                                alt={emp.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                {initialsFromName(emp.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">
                                {emp.name}
                              </p>
                              <p className="truncate text-xs text-gray-500">
                                {emp.title ?? "No title"} · {emp.email ?? "No email"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${deptClass}`}>
                            {dept}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {emp.is_internal_candidate ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {emp.years_of_experience != null
                                  ? `${emp.years_of_experience} yrs`
                                  : "Exp n/a"}
                              </span>
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {emp.availability_status ?? "Availability n/a"}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                {emp.current_location ?? "Location n/a"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Not a candidate</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(emp.expertise ?? []).length > 0 ? (
                              (emp.expertise ?? []).slice(0, 3).map((skill) => (
                                <button
                                  key={`${emp.id}-${skill}`}
                                  type="button"
                                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
                                  onClick={() => setExpertiseFilter(skill)}
                                >
                                  {skill}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">Not mapped</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {emp.is_internal_candidate
                            ? emp.talent_pool ?? "Unassigned"
                            : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleActive(emp)}
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                lifecycle === "Internal Candidate"
                                  ? "bg-violet-100 text-violet-700"
                                  : lifecycle === "Active Employee"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {lifecycle}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                quickEditEmployeeId === emp.id
                                  ? setQuickEditEmployeeId(null)
                                  : openQuickEdit(emp)
                              }
                              className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                            >
                              Quick Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(emp)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                      {quickEditEmployeeId === emp.id && (
                        <tr className="bg-indigo-50/50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid gap-3 md:grid-cols-4">
                              <label className="block">
                                <span className="text-xs font-medium text-gray-600">
                                  Lifecycle
                                </span>
                                <select
                                  value={quickEditDraft.lifecycleStatus}
                                  onChange={(e) =>
                                    setQuickEditDraft((prev) => ({
                                      ...prev,
                                      lifecycleStatus: e.target.value as LifecycleStatus,
                                    }))
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                                >
                                  <option value="Active Employee">Active Employee</option>
                                  <option value="Internal Candidate">Internal Candidate</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-gray-600">
                                  Talent Pool
                                </span>
                                <select
                                  value={quickEditDraft.talentPool}
                                  onChange={(e) =>
                                    setQuickEditDraft((prev) => ({
                                      ...prev,
                                      talentPool: e.target.value as TalentPool,
                                    }))
                                  }
                                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                                >
                                  <option value="Full-Stack">Full-Stack</option>
                                  <option value="DevOps">DevOps</option>
                                  <option value="Product Management">Product Management</option>
                                  <option value="Data">Data</option>
                                </select>
                              </label>
                              <div className="md:col-span-2">
                                <span className="text-xs font-medium text-gray-600">
                                  Expertise
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {availableSkills.map((skill) => {
                                    const active =
                                      quickEditDraft.selectedExpertise.includes(skill);
                                    return (
                                      <button
                                        key={`${emp.id}-quick-${skill}`}
                                        type="button"
                                        onClick={() =>
                                          setQuickEditDraft((prev) => ({
                                            ...prev,
                                            selectedExpertise: prev.selectedExpertise.includes(
                                              skill,
                                            )
                                              ? prev.selectedExpertise.filter(
                                                  (s) => s !== skill,
                                                )
                                              : [...prev.selectedExpertise, skill],
                                          }))
                                        }
                                        className={`rounded-full px-2 py-1 text-xs ${
                                          active
                                            ? "bg-indigo-600 text-white"
                                            : "bg-white text-gray-700 hover:bg-gray-100"
                                        }`}
                                      >
                                        {skill}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700">
                                Current: {emp.current_location ?? "n/a"}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700">
                                Availability: {emp.availability_status ?? "n/a"}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700">
                                Experience:{" "}
                                {emp.years_of_experience != null
                                  ? `${emp.years_of_experience} yrs`
                                  : "n/a"}
                              </span>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setQuickEditEmployeeId(null)}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveQuickEdit(emp)}
                                disabled={loading}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                              >
                                Save Quick Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Employee
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <input
                  type="radio"
                  name="addEmployeeMode"
                  checked={addEmployeeMode === "new"}
                  onChange={() => {
                    setAddEmployeeMode("new");
                    setSelectedExistingEmployeeId("");
                  }}
                />
                <span className="text-sm font-medium text-gray-700">
                  Add New Employee
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <input
                  type="radio"
                  name="addEmployeeMode"
                  checked={addEmployeeMode === "existing"}
                  onChange={() => setAddEmployeeMode("existing")}
                />
                <span className="text-sm font-medium text-gray-700">
                  Add Existing Employee
                </span>
              </label>
              {addEmployeeMode === "existing" && (
                <label className="md:col-span-2">
                  <span className="text-sm text-gray-600">Select Existing Employee</span>
                  <select
                    value={selectedExistingEmployeeId}
                    onChange={(e) => loadExistingEmployeeIntoForm(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Choose an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                        {employee.email ? ` (${employee.email})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm text-gray-600">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required={addEmployeeMode === "new"}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Department</span>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">GitHub</span>
                <input
                  value={form.githubUrl}
                  onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">LinkedIn</span>
                <input
                  value={form.linkedinUrl}
                  onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Portfolio URL</span>
                <input
                  value={form.portfolioUrl}
                  onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                  placeholder="https://portfolio.example.com"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Resume URL</span>
                <input
                  value={form.resumeUrl}
                  onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm text-gray-600">Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <div className="md:col-span-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.registerAsCandidate}
                    onChange={(e) =>
                      setForm({ ...form, registerAsCandidate: e.target.checked })
                    }
                  />
                  <span className="text-sm font-medium text-violet-800">
                    Register as Candidate
                  </span>
                </label>
                {form.registerAsCandidate && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label>
                      <span className="text-sm text-violet-800">Talent Pool</span>
                      <select
                        value={form.talentPool}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            talentPool: e.target.value as TalentPool,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-violet-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Full-Stack">Full-Stack</option>
                        <option value="DevOps">DevOps</option>
                        <option value="Product Management">
                          Product Management
                        </option>
                        <option value="Data">Data</option>
                      </select>
                    </label>
                    <div>
                      <span className="text-sm text-violet-800">
                        Expertise Mapping (Skills Config)
                      </span>
                      <div className="mt-1 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-md border border-violet-200 bg-white p-2">
                        {availableSkills.length === 0 && (
                          <p className="text-xs text-gray-500">
                            No active skills found in Skills Config.
                          </p>
                        )}
                        {availableSkills.map((skill) => {
                          const active = form.selectedExpertise.includes(skill);
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleExpertiseSelection(skill)}
                              className={`rounded-full px-2 py-1 text-xs ${
                                active
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label>
                      <span className="text-sm text-violet-800">Current Location</span>
                      <input
                        value={form.currentLocation}
                        onChange={(e) =>
                          setForm({ ...form, currentLocation: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-violet-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label>
                      <span className="text-sm text-violet-800">Availability</span>
                      <select
                        value={form.availabilityStatus}
                        onChange={(e) =>
                          setForm({ ...form, availabilityStatus: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-violet-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Immediate">Immediate</option>
                        <option value="2 Weeks">2 Weeks</option>
                        <option value="1 Month">1 Month</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-sm text-violet-800">Years of Experience</span>
                      <input
                        type="number"
                        min={0}
                        value={form.yearsOfExperience}
                        onChange={(e) =>
                          setForm({ ...form, yearsOfExperience: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-violet-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="md:col-span-2">
                      <span className="text-sm text-violet-800">Candidate Notes</span>
                      <textarea
                        rows={2}
                        value={form.candidateNotes}
                        onChange={(e) =>
                          setForm({ ...form, candidateNotes: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border border-violet-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                )}
              </div>
              <label className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendInviteEmail}
                  onChange={(e) =>
                    setForm({ ...form, sendInviteEmail: e.target.checked })
                  }
                />
                <span className="text-sm text-gray-700">
                  Send automated invitation email
                </span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setAddEmployeeMode("new");
                  setSelectedExistingEmployeeId("");
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Save Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleBulkImport}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Bulk Import Employees
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <p className="mb-2 text-sm text-gray-500">
              Paste CSV rows with header: name,email,title,department
            </p>
            <textarea
              rows={10}
              value={bulkImportInput}
              onChange={(e) => setBulkImportInput(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </form>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleUpdateEmployee}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Employee</h3>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm text-gray-600">Name</span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Title</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Department</span>
                <input
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">GitHub</span>
                <input
                  value={editForm.githubUrl}
                  onChange={(e) => setEditForm({ ...editForm, githubUrl: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">LinkedIn</span>
                <input
                  value={editForm.linkedinUrl}
                  onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Portfolio URL</span>
                <input
                  value={editForm.portfolioUrl}
                  onChange={(e) =>
                    setEditForm({ ...editForm, portfolioUrl: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Resume URL</span>
                <input
                  value={editForm.resumeUrl}
                  onChange={(e) => setEditForm({ ...editForm, resumeUrl: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm text-gray-600">Bio</span>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Lifecycle Status</span>
                <select
                  value={editForm.lifecycleStatus}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      lifecycleStatus: e.target.value as LifecycleStatus,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Active Employee">Active Employee</option>
                  <option value="Internal Candidate">Internal Candidate</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <label>
                <span className="text-sm text-gray-600">Talent Pool</span>
                <select
                  value={editForm.talentPool}
                  onChange={(e) =>
                    setEditForm({ ...editForm, talentPool: e.target.value as TalentPool })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Full-Stack">Full-Stack</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Product Management">Product Management</option>
                  <option value="Data">Data</option>
                </select>
              </label>
              <label>
                <span className="text-sm text-gray-600">Current Location</span>
                <input
                  value={editForm.currentLocation}
                  onChange={(e) =>
                    setEditForm({ ...editForm, currentLocation: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Availability</span>
                <select
                  value={editForm.availabilityStatus}
                  onChange={(e) =>
                    setEditForm({ ...editForm, availabilityStatus: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Immediate">Immediate</option>
                  <option value="2 Weeks">2 Weeks</option>
                  <option value="1 Month">1 Month</option>
                </select>
              </label>
              <label>
                <span className="text-sm text-gray-600">Years of Experience</span>
                <input
                  type="number"
                  min={0}
                  value={editForm.yearsOfExperience}
                  onChange={(e) =>
                    setEditForm({ ...editForm, yearsOfExperience: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm text-gray-600">Candidate Notes</span>
                <textarea
                  rows={2}
                  value={editForm.candidateNotes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, candidateNotes: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <div className="md:col-span-2">
                <span className="text-sm text-gray-600">Expertise Mapping</span>
                <div className="mt-1 flex max-h-24 flex-wrap gap-2 overflow-auto rounded-md border border-gray-300 bg-white p-2">
                  {availableSkills.map((skill) => {
                    const active = editForm.selectedExpertise.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            selectedExpertise: prev.selectedExpertise.includes(skill)
                              ? prev.selectedExpertise.filter((s) => s !== skill)
                              : [...prev.selectedExpertise, skill],
                          }))
                        }
                        className={`rounded-full px-2 py-1 text-xs ${
                          active
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.sendInviteEmail}
                  onChange={(e) =>
                    setEditForm({ ...editForm, sendInviteEmail: e.target.checked })
                  }
                />
                <span className="text-sm text-gray-700">Resend invitation email</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
