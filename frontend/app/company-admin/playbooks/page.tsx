"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createPlaybook,
  listPlaybooks,
  publishPlaybook,
  updatePlaybook,
} from "../../../lib/adminApi";
import type { PlaybookResponse } from "../../../lib/adminTypes";

type DraftFormState = {
  name: string;
  slug: string;
  config_json: string;
  is_default: boolean;
};

const DEFAULT_CONFIG = '{\n  "workflow": {\n    "required_fields": ["role_title", "skills", "seniority", "budget_max", "availability"]\n  },\n  "prompts": {},\n  "messages": {\n    "requirements_summary_intro": "Here is what I understood. Please confirm or edit."\n  }\n}';

export default function PlaybooksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryPlaybookId = searchParams.get("playbookId");
  const [playbooks, setPlaybooks] = useState<PlaybookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<DraftFormState>({
    name: "",
    slug: "",
    config_json: DEFAULT_CONFIG,
    is_default: false,
  });
  const [savingCreate, setSavingCreate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editConfigJson, setEditConfigJson] = useState("");
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaybooks();
      setPlaybooks(data);
      setSelectedId((prevSelectedId) => {
        if (queryPlaybookId && data.some((playbook) => playbook.id === queryPlaybookId)) {
          return queryPlaybookId;
        }
        if (!prevSelectedId && data.length > 0) {
          return data[0].id;
        }
        if (prevSelectedId && data.some((playbook) => playbook.id === prevSelectedId)) {
          return prevSelectedId;
        }
        return data[0]?.id ?? null;
      });
    } catch {
      setError("Unable to load playbooks right now.");
    } finally {
      setLoading(false);
    }
  }, [queryPlaybookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => playbooks.find((playbook) => playbook.id === selectedId) ?? null,
    [playbooks, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditConfigJson(JSON.stringify(selected.config_json, null, 2));
    setEditIsDefault(selected.is_default);
  }, [selected]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSavingCreate(true);
    setError(null);
    try {
      const parsed = JSON.parse(createForm.config_json) as Record<string, unknown>;
      const created = await createPlaybook({
        name: createForm.name.trim(),
        slug: createForm.slug.trim().toLowerCase(),
        config_json: parsed,
        is_default: createForm.is_default,
      });
      setPlaybooks((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateForm({
        name: "",
        slug: "",
        config_json: DEFAULT_CONFIG,
        is_default: false,
      });
    } catch {
      setError("Create failed. Verify slug and JSON config.");
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleSaveSelected() {
    if (!selected) return;
    setSavingEdit(true);
    setError(null);
    try {
      const parsed = JSON.parse(editConfigJson) as Record<string, unknown>;
      const updated = await updatePlaybook(selected.id, {
        name: editName.trim(),
        config_json: parsed,
        is_default: editIsDefault,
      });
      setPlaybooks((prev) =>
        prev.map((item) => (item.id === selected.id ? updated : item)),
      );
    } catch {
      setError("Update failed. Fix JSON and retry.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePublishSelected() {
    if (!selected) return;
    setError(null);
    try {
      const result = await publishPlaybook(selected.id);
      setPlaybooks((prev) =>
        prev.map((item) => (item.id === selected.id ? result.playbook : item)),
      );
    } catch {
      setError("Publish failed. Ensure config passes validation.");
    }
  }

  async function handleCloneSelected() {
    if (!selected) return;
    setError(null);
    try {
      const baseSlug = selected.slug.replace(/-v\d+$/, "");
      const clone = await createPlaybook({
        name: `${selected.name} Copy`,
        slug: `${baseSlug}-v${Date.now().toString().slice(-4)}`,
        config_json: selected.config_json,
        is_default: false,
      });
      setPlaybooks((prev) => [clone, ...prev]);
      setSelectedId(clone.id);
    } catch {
      setError("Clone failed. Try again with a unique slug.");
    }
  }

  const selectPlaybook = useCallback(
    (playbookId: string) => {
      setSelectedId(playbookId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("playbookId", playbookId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Playbooks</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage reusable conversation behavior packs per company.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <div className="md:col-span-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
          <p className="font-medium">How to fill this form</p>
          <p>
            <strong>Name:</strong> Human-readable playbook label shown to admins.
          </p>
          <p>
            <strong>Slug:</strong> Stable unique id (lowercase letters, numbers, dashes).
          </p>
          <p>
            <strong>Config JSON:</strong> Rules/prompts/messages used at runtime. Must be valid JSON.
          </p>
          <p>
            <strong>How to add fields:</strong> append new input keys in `workflow.required_fields`.
          </p>
          <p>
            <strong>How to add templates:</strong> create named entries under `prompts` and `messages`
            using string values.
          </p>
          <pre className="rounded-md border border-indigo-200 bg-white p-2 text-[11px] overflow-x-auto">{`{
  "workflow": {
    "required_fields": ["role_title", "skills", "budget_max"]
  },
  "prompts": {
    "qualification_check": "Ask follow-up questions for missing requirements."
  },
  "messages": {
    "requirements_summary_intro": "Please confirm these requirements."
  }
}`}</pre>
        </div>
        <label>
          <span className="text-sm text-gray-600">Name</span>
          <p className="mt-1 text-xs text-gray-500">Example: Candidate Intake Flow</p>
          <input
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Candidate Intake Flow"
          />
        </label>
        <label>
          <span className="text-sm text-gray-600">Slug</span>
          <p className="mt-1 text-xs text-gray-500">Used in APIs and deep links.</p>
          <input
            value={createForm.slug}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
            }
            required
            pattern="^[a-z0-9\-]+$"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="candidate-intake-flow"
          />
        </label>
        <label className="md:col-span-2">
          <span className="text-sm text-gray-600">Config JSON</span>
          <p className="mt-1 text-xs text-gray-500">
            Keep top-level keys like workflow, prompts, and messages.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Add new required inputs in `workflow.required_fields` as string ids.
          </p>
          <textarea
            rows={7}
            value={createForm.config_json}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, config_json: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={createForm.is_default}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, is_default: e.target.checked }))
            }
          />
          <span className="text-sm text-gray-600">Set as default</span>
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingCreate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {savingCreate ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
            Existing playbooks
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {loading && <p className="px-4 py-3 text-sm text-gray-500">Loading...</p>}
            {!loading &&
              playbooks.map((playbook) => (
                <button
                  key={playbook.id}
                  onClick={() => selectPlaybook(playbook.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 ${
                    playbook.id === selectedId ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{playbook.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {playbook.slug} v{playbook.version}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {playbook.status}
                    </span>
                    {playbook.is_default && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">
                        default
                      </span>
                    )}
                  </div>
                </button>
              ))}
            {!loading && playbooks.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">No playbooks found.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-gray-500">Select a playbook to edit.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selected.slug} v{selected.version}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleCloneSelected()}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => void handlePublishSelected()}
                    disabled={selected.status === "published"}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Publish
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="text-sm text-gray-600">Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-600">Config JSON</span>
                <p className="mt-1 text-xs text-gray-500">
                  Edit runtime behavior safely; publish after validating output.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Keep existing keys unless intentionally deprecating behavior for bound actions.
                </p>
                <textarea
                  rows={14}
                  value={editConfigJson}
                  onChange={(e) => setEditConfigJson(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono"
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editIsDefault}
                  onChange={(e) => setEditIsDefault(e.target.checked)}
                />
                <span className="text-sm text-gray-600">Set as tenant default playbook</span>
              </label>

              <div className="flex justify-end">
                <button
                  onClick={() => void handleSaveSelected()}
                  disabled={savingEdit}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Draft"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
