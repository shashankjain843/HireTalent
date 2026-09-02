"use client";

import { useEffect, useState } from "react";
import {
  createSkillTemplate,
  exportSkillTemplateHistory,
  listSkillTemplates,
  listSkillTemplateHistory,
  updateSkillTemplate,
} from "../../../lib/adminApi";
import type {
  SkillTemplateAuditEventResponse,
  SkillTemplateResponse,
} from "../../../lib/adminTypes";

function safeParseJson(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Default config must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SkillTemplatesPage() {
  const [templates, setTemplates] = useState<SkillTemplateResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [skillType, setSkillType] = useState("");
  const [description, setDescription] = useState("");
  const [defaultConfigText, setDefaultConfigText] = useState("{}");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [selected, setSelected] = useState<SkillTemplateResponse | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDefaultConfigText, setEditDefaultConfigText] = useState("{}");
  const [pendingDeactivate, setPendingDeactivate] =
    useState<SkillTemplateResponse | null>(null);
  const [historyTemplate, setHistoryTemplate] = useState<SkillTemplateResponse | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<
    SkillTemplateAuditEventResponse[]
  >([]);
  const [historyActionFilter, setHistoryActionFilter] = useState<
    "all" | "create" | "update" | "delete" | "upsert"
  >("all");
  const [historyRangeDays, setHistoryRangeDays] = useState<"all" | "7" | "30" | "90">(
    "all",
  );
  const [historyOnlyChangedFields, setHistoryOnlyChangedFields] = useState(false);

  useEffect(() => {
    listSkillTemplates()
      .then(setTemplates)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = safeParseJson(defaultConfigText.trim().length ? defaultConfigText : "{}");
      const created = await createSkillTemplate({
        name: name.trim(),
        skill_type: skillType.trim(),
        description: description.trim() || undefined,
        default_config: parsed,
      });
      setTemplates((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
      setSkillType("");
      setDescription("");
      setDefaultConfigText("{}");
      setNotice(`Template "${created.name}" created.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(t: SkillTemplateResponse) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSkillTemplate(t.id, { is_active: !t.is_active });
      setTemplates((prev) => prev.map((row) => (row.id === t.id ? updated : row)));
      setNotice(
        updated.is_active
          ? `Template "${updated.name}" enabled for company admins.`
          : `Template "${updated.name}" disabled for company admins.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function closeEditDrawer() {
    if (!selected) return;
    const originalDescription = selected.description ?? "";
    const originalConfig = JSON.stringify(selected.default_config ?? {}, null, 2);
    const hasUnsavedChanges =
      editDescription !== originalDescription ||
      editDefaultConfigText !== originalConfig;
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        "You have unsaved changes. Discard and close?",
      );
      if (!shouldDiscard) return;
    }
    setSelected(null);
  }

  function openEditDrawer(template: SkillTemplateResponse) {
    setSelected(template);
    setEditDescription(template.description ?? "");
    setEditDefaultConfigText(JSON.stringify(template.default_config ?? {}, null, 2));
    setError(null);
    setNotice(null);
  }

  async function openHistory(template: SkillTemplateResponse) {
    setHistoryTemplate(template);
    setHistoryLoading(true);
    setHistoryEvents([]);
    setError(null);
    try {
      const events = await listSkillTemplateHistory(template.id, 75);
      setHistoryEvents(events);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSaveTemplateChanges() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = safeParseJson(
        editDefaultConfigText.trim().length ? editDefaultConfigText : "{}",
      );
      const updated = await updateSkillTemplate(selected.id, {
        description: editDescription.trim() || undefined,
        default_config: parsed,
      });
      setTemplates((prev) =>
        prev.map((row) => (row.id === selected.id ? updated : row)),
      );
      setSelected(updated);
      setNotice(`Template "${updated.name}" updated.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = templates.filter((t) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.is_active) ||
      (statusFilter === "inactive" && !t.is_active);
    const haystack = `${t.name} ${t.skill_type} ${t.description ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase().trim());
    return matchesStatus && matchesQuery;
  });
  const activeCount = templates.filter((t) => t.is_active).length;
  const inactiveCount = templates.length - activeCount;
  const filteredHistoryEvents = historyEvents.filter((event) => {
    const matchesAction =
      historyActionFilter === "all" || event.action === historyActionFilter;
    if (!matchesAction) return false;
    if (historyRangeDays === "all") return true;
    const days = Number(historyRangeDays);
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(event.created_at).getTime() >= threshold;
  });

  async function downloadServerExport(format: "json" | "csv") {
    if (!historyTemplate) return;
    try {
      setError(null);
      setNotice(null);
      const resp = await exportSkillTemplateHistory(historyTemplate.id, {
        format,
        limit: 2000,
        action: historyActionFilter,
        window_days: historyRangeDays === "all" ? 0 : Number(historyRangeDays),
        only_changed_fields: historyOnlyChangedFields,
      });
      const url = URL.createObjectURL(resp.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(
        `Server-signed ${format.toUpperCase()} export downloaded. SHA256: ${resp.sha256 ?? "n/a"}`,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="relative">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Skill Templates</h2>
          <p className="mt-1 text-sm text-gray-500">
            Control the global skill catalog and what Company Admins can configure.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs min-w-72">
          <div>
            <div className="text-gray-500">Total</div>
            <div className="text-base font-semibold text-gray-900">{templates.length}</div>
          </div>
          <div>
            <div className="text-gray-500">Active</div>
            <div className="text-base font-semibold text-emerald-700">{activeCount}</div>
          </div>
          <div>
            <div className="text-gray-500">Inactive</div>
            <div className="text-base font-semibold text-gray-700">{inactiveCount}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <form
        onSubmit={handleCreateTemplate}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h3 className="mb-1 text-base font-semibold text-gray-900">
          Create Skill Template
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          New templates become available to all companies when marked active.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Knowledge Curator"
            />
          </label>
          <label className="text-sm text-gray-700">
            Skill Type
            <input
              required
              value={skillType}
              onChange={(e) => setSkillType(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="knowledge_curator"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-gray-700">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-20"
            placeholder="What this skill does and when to use it."
          />
        </label>
        <label className="mt-3 block text-sm text-gray-700">
          Default Config (JSON)
          <textarea
            value={defaultConfigText}
            onChange={(e) => setDefaultConfigText(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-24 font-mono"
          />
        </label>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            Tip: Use JSON object format for defaults.
          </span>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Create Template
          </button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, type, description..."
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "active" | "inactive")
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} templates shown</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2 gap-3">
              <h3 className="font-medium text-gray-900">{t.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {t.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3 min-h-10">
              {t.description || "No description provided."}
            </p>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>
                Type: <strong className="text-gray-700">{t.skill_type}</strong>
              </span>
              <span>
                Version: <strong className="text-gray-700">v{t.version}</strong>
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {t.is_active ? (
                <button
                  onClick={() => setPendingDeactivate(t)}
                  disabled={loading}
                  className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 hover:bg-green-200"
                >
                  Active (click to disable)
                </button>
              ) : (
                <button
                  onClick={() => handleToggleActive(t)}
                  disabled={loading}
                  className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Inactive (click to enable)
                </button>
              )}
              <button
                onClick={() => openEditDrawer(t)}
                className="text-xs px-3 py-1 rounded-full font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                Edit
              </button>
              <button
                onClick={() => openHistory(t)}
                className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                View History
              </button>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500 flex items-center justify-between">
              <span>Template ID: {t.id.slice(0, 8)}...</span>
              <span>Created: {new Date(t.created_at).toLocaleDateString()}</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-500 flex items-center justify-between">
              <span>
                Last Updated:{" "}
                {t.last_updated_at
                  ? new Date(t.last_updated_at).toLocaleString()
                  : "N/A"}
              </span>
              <span>By: {t.last_updated_by ?? "System"}</span>
            </div>
            {t.default_config && Object.keys(t.default_config).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-indigo-600 cursor-pointer">
                  Default Config
                </summary>
                <pre className="mt-1 text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
                  {JSON.stringify(t.default_config, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm">
            No templates match the current filters.
          </p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeEditDrawer}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Type: {selected.skill_type} | Version: v{selected.version}
                </p>
              </div>
              <button
                onClick={closeEditDrawer}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block text-sm text-gray-700">
                Description
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-24"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Default Config (JSON object)
                <textarea
                  value={editDefaultConfigText}
                  onChange={(e) => setEditDefaultConfigText(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-72 font-mono"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeEditDrawer}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplateChanges}
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Save Changes
              </button>
            </div>
          </aside>
        </div>
      )}

      {pendingDeactivate && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPendingDeactivate(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900">
              Disable template?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              <strong>{pendingDeactivate.name}</strong> will be hidden from Company
              Admin skill configuration and blocked at API level.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeactivate(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const template = pendingDeactivate;
                  setPendingDeactivate(null);
                  if (!template) return;
                  await handleToggleActive(template);
                }}
                disabled={loading}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Disable Template
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTemplate && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setHistoryTemplate(null)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Change History
                </h3>
                <p className="text-sm text-gray-500 mt-1">{historyTemplate.name}</p>
              </div>
              <button
                onClick={() => setHistoryTemplate(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {historyLoading ? (
              <p className="mt-6 text-sm text-gray-500">Loading audit timeline...</p>
            ) : historyEvents.length === 0 ? (
              <p className="mt-6 text-sm text-gray-500">No history available.</p>
            ) : (
              <div className="mt-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <select
                    value={historyActionFilter}
                    onChange={(e) =>
                      setHistoryActionFilter(
                        e.target.value as "all" | "create" | "update" | "delete" | "upsert",
                      )
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="all">All actions</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="upsert">Upsert</option>
                    <option value="delete">Delete</option>
                  </select>
                  <select
                    value={historyRangeDays}
                    onChange={(e) =>
                      setHistoryRangeDays(e.target.value as "all" | "7" | "30" | "90")
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="all">All time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                  <span className="text-xs text-gray-500">
                    {filteredHistoryEvents.length} events
                  </span>
                  <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={historyOnlyChangedFields}
                      onChange={(e) => setHistoryOnlyChangedFields(e.target.checked)}
                    />
                    Only show changed fields
                  </label>
                  <button
                    onClick={() => downloadServerExport("json")}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => downloadServerExport("csv")}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="space-y-4">
                {filteredHistoryEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 uppercase">
                        {event.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                      {event.actor_name || event.actor_email || "System"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Event ID: {event.id.slice(0, 8)}...
                    </p>
                    {event.changes && (
                      <div className="mt-3 space-y-2">
                        {Object.entries(event.changes).map(([field, raw]) => {
                          const value = raw as
                            | { old?: unknown; new?: unknown }
                            | unknown;
                          const oldValue =
                            value && typeof value === "object" && !Array.isArray(value)
                              ? (value as { old?: unknown }).old
                              : undefined;
                          const newValue =
                            value && typeof value === "object" && !Array.isArray(value)
                              ? (value as { new?: unknown }).new
                              : value;
                          if (
                            historyOnlyChangedFields &&
                            JSON.stringify(oldValue) === JSON.stringify(newValue)
                          ) {
                            return null;
                          }
                          return (
                            <div
                              key={`${event.id}-${field}`}
                              className="rounded-md border border-gray-200 bg-gray-50 p-3"
                            >
                              <div className="text-xs font-medium text-gray-800">{field}</div>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    Before
                                  </div>
                                  <pre className="mt-1 max-h-36 overflow-auto rounded bg-white p-2 text-[11px] text-gray-700 border border-gray-200">
                                    {prettyJson(oldValue)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                                    After
                                  </div>
                                  <pre className="mt-1 max-h-36 overflow-auto rounded bg-emerald-50 p-2 text-[11px] text-emerald-900 border border-emerald-200">
                                    {prettyJson(newValue)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {event.changes && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-indigo-600">
                          View change payload
                        </summary>
                        <pre className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">
                          {JSON.stringify(event.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                {filteredHistoryEvents.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No events match the selected filters.
                  </p>
                )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
