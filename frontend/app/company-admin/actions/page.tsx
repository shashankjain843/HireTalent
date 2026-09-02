"use client";

import { useEffect, useRef, useState } from "react";
import {
  bindActionPlaybook,
  createAction,
  createPlaybook,
  deleteAction,
  listActions,
  listCategories,
  listPlaybooks,
  publishPlaybook,
  updateAction,
} from "../../../lib/adminApi";
import type {
  ActionResponse,
  CategoryResponse,
  PlaybookResponse,
} from "../../../lib/adminTypes";

export default function ActionsPage() {
  const actionRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const governanceDeepLinkDone = useRef(false);
  const [focusActionId, setFocusActionId] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    prompt_template: "",
    icon: "",
    category_id: "",
    playbook_id: "",
    is_pinned: false,
  });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ActionResponse | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    prompt_template: "",
    icon: "",
    category_id: "",
    playbook_id: "",
    is_pinned: false,
    is_active: true,
  });
  const [playbookForm, setPlaybookForm] = useState({
    name: "",
    slug: "",
    config_json: '{\n  "workflow": {\n    "required_fields": ["role_title", "skills", "seniority", "budget_max", "availability"]\n  },\n  "prompts": {},\n  "messages": {}\n}',
    is_default: false,
  });
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  async function loadInitialData() {
    setInitialLoading(true);
    setLoadError(null);

    const [actionsRes, categoriesRes, playbooksRes] = await Promise.allSettled([
      listActions(),
      listCategories(),
      listPlaybooks(),
    ]);

    if (actionsRes.status === "fulfilled") {
      setActions(actionsRes.value);
    } else {
      setLoadError("Could not load actions. Please refresh and try again.");
    }

    if (categoriesRes.status === "fulfilled") {
      setCategories(categoriesRes.value);
    } else {
      // Keep actions visible even if category metadata fails.
      setLoadError((prev) =>
        prev
          ? `${prev} Categories are temporarily unavailable.`
          : "Categories are temporarily unavailable.",
      );
    }
    if (playbooksRes.status === "fulfilled") {
      setPlaybooks(playbooksRes.value);
    } else {
      setLoadError((prev) =>
        prev
          ? `${prev} Playbooks are temporarily unavailable.`
          : "Playbooks are temporarily unavailable.",
      );
    }

    setInitialLoading(false);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFocusActionId(new URL(window.location.href).searchParams.get("actionId"));
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!focusActionId || actions.length === 0 || governanceDeepLinkDone.current) return;
    const idx = actions.findIndex((x) => x.id === focusActionId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
    governanceDeepLinkDone.current = true;
  }, [focusActionId, actions, pageSize]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const a = await createAction({
        ...form,
        category_id: form.category_id || undefined,
        playbook_id: form.playbook_id || undefined,
      });
      setActions([...actions, a]);
      setShowForm(false);
      setForm({
        title: "",
        description: "",
        prompt_template: "",
        icon: "",
        category_id: "",
        playbook_id: "",
        is_pinned: false,
      });
    } catch {}
    setLoading(false);
  }

  async function togglePin(a: ActionResponse) {
    const updated = await updateAction(a.id, { is_pinned: !a.is_pinned });
    setActions(actions.map((x) => (x.id === a.id ? updated : x)));
  }

  async function toggleActive(a: ActionResponse) {
    const updated = await updateAction(a.id, { is_active: !a.is_active });
    setActions(actions.map((x) => (x.id === a.id ? updated : x)));
  }

  async function handleDelete(id: string) {
    await deleteAction(id);
    setActions(actions.filter((a) => a.id !== id));
  }

  async function handleCreatePlaybook(e: React.FormEvent) {
    e.preventDefault();
    setPlaybookLoading(true);
    try {
      const parsedConfig = JSON.parse(playbookForm.config_json) as Record<string, unknown>;
      const created = await createPlaybook({
        name: playbookForm.name.trim(),
        slug: playbookForm.slug.trim(),
        config_json: parsedConfig,
        is_default: playbookForm.is_default,
      });
      setPlaybooks((prev) => [created, ...prev]);
      setPlaybookForm((prev) => ({
        ...prev,
        name: "",
        slug: "",
      }));
    } catch {
      setLoadError("Could not create playbook. Check JSON format and required fields.");
    } finally {
      setPlaybookLoading(false);
    }
  }

  async function handlePublishPlaybook(playbookId: string) {
    try {
      const result = await publishPlaybook(playbookId);
      setPlaybooks((prev) =>
        prev.map((item) => (item.id === playbookId ? result.playbook : item)),
      );
    } catch {
      setLoadError("Playbook publish failed. Ensure config_json matches validation rules.");
    }
  }

  async function handleBindPlaybook(actionId: string, playbookId: string | null) {
    try {
      const updated = await bindActionPlaybook(actionId, playbookId);
      setActions((prev) => prev.map((item) => (item.id === actionId ? updated : item)));
    } catch {
      setLoadError("Could not bind playbook to action.");
    }
  }

  function startEdit(action: ActionResponse) {
    setEditing(action);
    setEditForm({
      title: action.title,
      description: action.description ?? "",
      prompt_template: action.prompt_template ?? "",
      icon: action.icon ?? "",
      category_id: action.category_id ?? "",
      playbook_id: action.playbook_id ?? "",
      is_pinned: action.is_pinned,
      is_active: action.is_active,
    });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    try {
      const updated = await updateAction(editing.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        prompt_template: editForm.prompt_template || undefined,
        icon: editForm.icon || undefined,
        category_id: editForm.category_id || undefined,
        playbook_id: editForm.playbook_id || null,
        is_pinned: editForm.is_pinned,
        is_active: editForm.is_active,
      });
      setActions(actions.map((x) => (x.id === editing.id ? updated : x)));
      setEditing(null);
    } finally {
      setEditLoading(false);
    }
  }

  const filtered = actions
    .filter((a) =>
      statusFilter === "all" ? true : statusFilter === "active" ? a.is_active : !a.is_active,
    )
    .filter((a) =>
      pinnedFilter === "all" ? true : pinnedFilter === "pinned" ? a.is_pinned : !a.is_pinned,
    )
    .filter((a) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const categoryName =
        (categories.find((c) => c.id === a.category_id)?.name ?? "").toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        categoryName.includes(q)
      );
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (!focusActionId) return;
    const t = window.setTimeout(() => {
      actionRowRefs.current[focusActionId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);
    return () => window.clearTimeout(t);
  }, [focusActionId, page, paged]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Actions
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage conversation starters shown in the first chat screen.
          </p>
          {focusActionId && (
            <p className="mt-2 text-xs text-indigo-700 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 inline-block">
              Governance trace: action{" "}
              <code className="rounded bg-white/80 px-1">{focusActionId}</code>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          {showForm ? "Cancel" : "New Action"}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Playbook Manager</h3>
          <p className="text-xs text-gray-500 mt-1">
            Create and publish playbooks, then bind them to starter actions.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
          <p className="font-medium">How to use this section</p>
          <p>
            <strong>Playbook name:</strong> Human-friendly label (for example: Candidate Screening Flow).
          </p>
          <p>
            <strong>Slug:</strong> Unique id in lowercase with dashes only (for example:
            candidate-screening-flow).
          </p>
          <p>
            <strong>Config JSON:</strong> Workflow rules and message templates. Keep valid JSON format.
          </p>
          <p>
            <strong>Minimum shape:</strong> use `workflow`, `prompts`, and `messages` keys at top level.
          </p>
          <p>
            <strong>Add fields:</strong> include each required input in
            <code className="mx-1">{`workflow.required_fields`}</code> (for example:{" "}
            <code>{'["role_title", "skills", "location"]'}</code>).
          </p>
          <p>
            <strong>Add prompt/message templates:</strong> add new key/value pairs under `prompts` or
            `messages` (example key: `screening_intro`).
          </p>
          <pre className="rounded-md border border-indigo-200 bg-white p-2 text-[11px] overflow-x-auto">{`{
  "workflow": {
    "required_fields": ["role_title", "skills", "seniority"]
  },
  "prompts": {
    "intake": "Collect role details before proposing candidates."
  },
  "messages": {
    "requirements_summary_intro": "Here is what I understood."
  }
}`}</pre>
        </div>
        <form onSubmit={handleCreatePlaybook} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>
            <span className="text-sm text-gray-600">Playbook name</span>
            <p className="mt-1 text-xs text-gray-500">Visible label used in playbook dropdowns.</p>
            <input
              value={playbookForm.name}
              onChange={(e) => setPlaybookForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Candidate Screening Flow"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Slug</span>
            <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, and dashes only.</p>
            <input
              value={playbookForm.slug}
              onChange={(e) => setPlaybookForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
              required
              pattern="^[a-z0-9\-]+$"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="candidate-screening-flow"
            />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm text-gray-600">Config JSON</span>
            <p className="mt-1 text-xs text-gray-500">
              Defines required fields, prompts, and messages used when this playbook runs.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Tip: add new form inputs to `workflow.required_fields`, then add supporting text in
              `prompts`/`messages`.
            </p>
            <textarea
              rows={7}
              value={playbookForm.config_json}
              onChange={(e) => setPlaybookForm((prev) => ({ ...prev, config_json: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={playbookForm.is_default}
              onChange={(e) => setPlaybookForm((prev) => ({ ...prev, is_default: e.target.checked }))}
            />
            <span className="text-sm text-gray-600">Make default playbook</span>
          </label>
          <div className="flex justify-end md:col-span-1">
            <button
              type="submit"
              disabled={playbookLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {playbookLoading ? "Creating..." : "Create Playbook"}
            </button>
          </div>
        </form>
        <div className="rounded-lg border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Slug</th>
                <th className="text-left px-3 py-2">Version</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {playbooks.map((playbook) => (
                <tr key={playbook.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{playbook.name}</td>
                  <td className="px-3 py-2 text-gray-600">{playbook.slug}</td>
                  <td className="px-3 py-2">{playbook.version}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {playbook.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={playbook.status === "published"}
                      onClick={() => void handlePublishPlaybook(playbook.id)}
                      className="rounded-md border border-indigo-200 px-2 py-1 text-indigo-700 disabled:opacity-50"
                    >
                      Publish
                    </button>
                  </td>
                </tr>
              ))}
              {playbooks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                    No playbooks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 gap-4 shadow-sm"
        >
          <div className="col-span-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2">
            <p className="font-medium">How to create a starter action</p>
            <p>
              <strong>Title:</strong> Short user-facing suggestion shown on chat start.
            </p>
            <p>
              <strong>Prompt Template:</strong> Message sent to the assistant when clicked (you can use
              placeholders like {"{topic}"}).
            </p>
            <p>
              <strong>Category / Playbook:</strong> Optional routing. Leave blank to use default behavior.
            </p>
          </div>
          <label>
            <span className="text-sm text-gray-600">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Hire a developer"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Icon (name)</span>
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="code"
            />
          </label>
          <label className="col-span-2">
            <span className="text-sm text-gray-600">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Find and hire developers for specific tech profiles"
            />
          </label>
          <label className="col-span-2">
            <span className="text-sm text-gray-600">Prompt Template</span>
            <p className="mt-1 text-xs text-gray-500">
              This text is submitted when user clicks the action card.
            </p>
            <textarea
              value={form.prompt_template}
              onChange={(e) => setForm({ ...form, prompt_template: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="I want to hire a backend engineer with Python and FastAPI experience"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Category</span>
            <p className="mt-1 text-xs text-gray-500">Choose where this action belongs in admin analytics.</p>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm text-gray-600">Playbook</span>
            <p className="mt-1 text-xs text-gray-500">Optional custom flow for this specific action.</p>
            <select
              value={form.playbook_id}
              onChange={(e) => setForm({ ...form, playbook_id: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Use tenant/platform default</option>
              {playbooks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Pin to top 4</span>
          </label>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Create Action
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-2 shadow-sm">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search title, description, category..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={pinnedFilter}
          onChange={(e) => {
            setPinnedFilter(e.target.value as typeof pinnedFilter);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All pin states</option>
          <option value="pinned">Pinned</option>
          <option value="unpinned">Unpinned</option>
        </select>
        <p className="text-xs text-gray-500 self-center justify-self-end">
          {filtered.length} actions
        </p>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p>{loadError}</p>
          <button
            onClick={() => {
              void loadInitialData();
            }}
            disabled={initialLoading}
            className="shrink-0 px-2.5 py-1 rounded-md border border-amber-300 bg-white hover:bg-amber-100 disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Playbook</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Clicks</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Pinned</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialLoading &&
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-3"><div className="h-3 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-8 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                  <td className="px-4 py-3"><div className="h-6 w-24 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))}
            {paged.map((a) => (
              <tr
                key={a.id}
                ref={(el) => {
                  actionRowRefs.current[a.id] = el;
                }}
                className={`hover:bg-gray-50 ${focusActionId === a.id ? "bg-indigo-50/90 ring-2 ring-inset ring-indigo-400" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.title}</div>
                  <div className="text-xs text-gray-400">{a.description}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {categories.find((c) => c.id === a.category_id)?.name ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={a.playbook_id ?? ""}
                    onChange={(e) => void handleBindPlaybook(a.id, e.target.value || null)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">Default</option>
                    {playbooks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {a.click_count}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => togglePin(a)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.is_pinned
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.is_pinned ? "Pinned" : "Pin"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(a)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {a.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {a.playbook_id && (
                    <button
                      onClick={() => {
                        if (typeof window === "undefined") return;
                        window.location.href = `/company-admin/playbooks?playbookId=${a.playbook_id}`;
                      }}
                      className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      Open Playbook
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(a)}
                    className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!initialLoading && paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No actions yet. Create your first conversation starter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-gray-500">
          Page {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-300 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSave}
            className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Action
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Update title, prompt, category and visibility settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="text-sm text-gray-600">Title</span>
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Icon</span>
                <input
                  value={editForm.icon}
                  onChange={(e) =>
                    setEditForm({ ...editForm, icon: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="col-span-2">
                <span className="text-sm text-gray-600">Description</span>
                <input
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="col-span-2">
                <span className="text-sm text-gray-600">Prompt Template</span>
                <textarea
                  rows={3}
                  value={editForm.prompt_template}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      prompt_template: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label>
                <span className="text-sm text-gray-600">Category</span>
                <select
                  value={editForm.category_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category_id: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm text-gray-600">Playbook</span>
                <select
                  value={editForm.playbook_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, playbook_id: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Use default</option>
                  {playbooks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_pinned}
                    onChange={(e) =>
                      setEditForm({ ...editForm, is_pinned: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">Pinned</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm({ ...editForm, is_active: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">Active</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
