"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkMoveKnowledgeSourcesBetweenCategories,
  createCategory,
  getCompanyCategoryManagementAccess,
  getCategoryPolicy,
  getCategoryUsageHeatmap,
  getCategoryVisibilityMatrix,
  listCategoryKnowledgeSources,
  listCategoryTree,
  runAutoCategorization,
  simulateCategoryPolicy,
  updateCategory,
  upsertCategoryAutomation,
  upsertCategoryPolicy,
  upsertCategoryVisibilityMatrix,
} from "../../../lib/adminApi";
import type {
  CategoryPolicyResponse,
  CategoryRolePermissionUpsertItem,
  CategoryTreeNodeResponse,
  CategoryHeatmapPointResponse,
  KnowledgeSourceResponse,
} from "../../../lib/adminTypes";

const DEFAULT_VISIBILITY: CategoryRolePermissionUpsertItem[] = [
  { role: "admin", permission_level: "publish", inherits_to_children: true },
  { role: "editor", permission_level: "edit", inherits_to_children: true },
  { role: "viewer", permission_level: "view", inherits_to_children: true },
];

export default function CategoriesPage() {
  const [canManageCategories, setCanManageCategories] = useState(true);
  const [tree, setTree] = useState<CategoryTreeNodeResponse[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [visibilityRows, setVisibilityRows] = useState<CategoryRolePermissionUpsertItem[]>([]);
  const [categoryDocs, setCategoryDocs] = useState<KnowledgeSourceResponse[]>([]);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    parent_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [bulkSourceIds, setBulkSourceIds] = useState("");
  const [bulkTargetCategoryId, setBulkTargetCategoryId] = useState("");
  const [bulkMode, setBulkMode] = useState<"move" | "copy">("move");
  const [bulkResult, setBulkResult] = useState("");
  const [policy, setPolicy] = useState<CategoryPolicyResponse | null>(null);
  const [policyForm, setPolicyForm] = useState({
    system_instructions: "",
    retrieval_top_k: 8,
    min_score: "",
    citation_required: true,
    is_active: true,
  });
  const [simulatePrompt, setSimulatePrompt] = useState("");
  const [simulateResult, setSimulateResult] = useState<{
    answer: string;
    confidence: number;
    version: number;
    topK: number;
  } | null>(null);
  const [automationForm, setAutomationForm] = useState({
    auto_categorization_enabled: false,
    keywords: "",
    confidence_threshold: 0.75,
  });
  const [automationResult, setAutomationResult] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [heatmapWindowDays, setHeatmapWindowDays] = useState(30);
  const [heatmap, setHeatmap] = useState<CategoryHeatmapPointResponse[]>([]);

  const refreshTree = useCallback(async () => {
    setIsBusy(true);
    const rows = await listCategoryTree();
    setTree(rows);
    const all = flattenTree(rows);
    if (!selectedCategoryId && all.length > 0) {
      setSelectedCategoryId(all[0].id);
    }
    setIsBusy(false);
  }, [selectedCategoryId]);

  const allCategories = useMemo(() => flattenTree(tree), [tree]);
  const selectedCategory =
    allCategories.find((node) => node.id === selectedCategoryId) ?? null;
  const filteredTree = useMemo(() => filterTree(tree, filter), [tree, filter]);

  useEffect(() => {
    getCompanyCategoryManagementAccess()
      .then((resp) => setCanManageCategories(resp?.can_manage_categories ?? true))
      .catch(() => setCanManageCategories(true));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshTree().catch(() => {});
    });
  }, [refreshTree]);

  useEffect(() => {
    if (tree.length === 0 || typeof window === "undefined") return;
    const id = new URL(window.location.href).searchParams.get("categoryId");
    if (!id) return;
    const flat = flattenTree(tree);
    if (!flat.some((n) => n.id === id)) return;
    queueMicrotask(() => setSelectedCategoryId(id));
  }, [tree]);

  useEffect(() => {
    getCategoryUsageHeatmap(heatmapWindowDays).then(setHeatmap).catch(() => {});
  }, [heatmapWindowDays]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    getCategoryVisibilityMatrix(selectedCategoryId)
      .then((rows) => {
        if (!rows || rows.length === 0) {
          setVisibilityRows(DEFAULT_VISIBILITY);
          return;
        }
        setVisibilityRows(
          rows.map((row) => ({
            role: row.role,
            permission_level: row.permission_level || "none",
            inherits_to_children: Boolean(row.inherits_to_children),
          })),
        );
      })
      .catch(() => setVisibilityRows(DEFAULT_VISIBILITY));
    listCategoryKnowledgeSources(selectedCategoryId).then(setCategoryDocs).catch(() => {});
    getCategoryPolicy(selectedCategoryId)
      .then((row) => {
        setPolicy(row);
        if (!row) {
          setPolicyForm({
            system_instructions: "",
            retrieval_top_k: 8,
            min_score: "",
            citation_required: true,
            is_active: true,
          });
          return;
        }
        setPolicyForm({
          system_instructions: row.system_instructions,
          retrieval_top_k: row.retrieval_top_k,
          min_score: row.min_score == null ? "" : String(row.min_score),
          citation_required: row.citation_required,
          is_active: row.is_active,
        });
      })
      .catch(() => {});
    const current = allCategories.find((node) => node.id === selectedCategoryId);
    if (current) {
      queueMicrotask(() =>
        setAutomationForm({
          auto_categorization_enabled: current.auto_categorization_enabled,
          keywords: (current.auto_categorization_keywords || []).join(", "),
          confidence_threshold: current.auto_categorization_threshold ?? 0.75,
        }),
      );
    }
  }, [selectedCategoryId, allCategories]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await createCategory({
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        icon: form.icon || undefined,
        parent_id: form.parent_id || undefined,
      });
      setShowForm(false);
      setForm({ name: "", slug: "", description: "", icon: "", parent_id: "" });
      await refreshTree();
      setNotice({ type: "success", message: "Category created." });
    } catch {
      setNotice({ type: "error", message: "Failed to create category." });
    }
    setLoading(false);
  }

  async function toggleActive() {
    if (!selectedCategory) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setNotice(null);
    setActionBusy(true);
    try {
      await updateCategory(selectedCategory.id, { is_active: !selectedCategory.is_active });
      await refreshTree();
      setNotice({
        type: "success",
        message: selectedCategory.is_active ? "Category deactivated." : "Category activated.",
      });
    } catch {
      setNotice({ type: "error", message: "Failed to update category status." });
    }
    setActionBusy(false);
  }

  async function saveVisibility() {
    if (!selectedCategoryId) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setNotice(null);
    setActionBusy(true);
    try {
      const saved = await upsertCategoryVisibilityMatrix(selectedCategoryId, visibilityRows);
      if (saved && Array.isArray(saved)) {
        setVisibilityRows(
          saved.map((row) => ({
            role: row.role,
            permission_level: row.permission_level || "none",
            inherits_to_children: Boolean(row.inherits_to_children),
          }))
        );
      }
      await refreshTree();
      setNotice({ type: "success", message: "Visibility matrix saved successfully." });
    } catch {
      setNotice({ type: "error", message: "Failed to save visibility matrix." });
    }
    setActionBusy(false);
  }

  async function runBulkMove(dryRun: boolean) {
    if (!selectedCategoryId || !bulkTargetCategoryId) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    const sourceIds = bulkSourceIds
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean);
    if (sourceIds.length === 0) return;
    setNotice(null);
    setActionBusy(true);
    try {
      const result = await bulkMoveKnowledgeSourcesBetweenCategories({
        source_ids: sourceIds,
        from_category_id: selectedCategoryId,
        to_category_id: bulkTargetCategoryId,
        mode: bulkMode,
        dry_run: dryRun,
      });
      setBulkResult(
        `${dryRun ? "Dry run" : "Applied"}: matched ${result.total_matched}, moved ${result.moved}, copied ${result.copied}, skipped ${result.skipped_existing}.`,
      );
      await refreshTree();
      if (!dryRun) {
        await listCategoryKnowledgeSources(selectedCategoryId)
          .then(setCategoryDocs)
          .catch(() => {});
      }
      setNotice({
        type: "success",
        message: dryRun ? "Bulk move dry-run complete." : "Bulk move applied.",
      });
    } catch {
      setNotice({ type: "error", message: "Bulk move failed." });
    }
    setActionBusy(false);
  }

  async function savePolicy() {
    if (!selectedCategoryId) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setNotice(null);
    setActionBusy(true);
    try {
      const saved = await upsertCategoryPolicy(selectedCategoryId, {
        system_instructions: policyForm.system_instructions,
        retrieval_top_k: policyForm.retrieval_top_k,
        min_score: policyForm.min_score === "" ? null : Number(policyForm.min_score),
        citation_required: policyForm.citation_required,
        is_active: policyForm.is_active,
        source_priority: null,
      });
      setPolicy(saved);
      await refreshTree();
      setNotice({ type: "success", message: "Policy saved." });
    } catch {
      setNotice({ type: "error", message: "Failed to save policy." });
    }
    setActionBusy(false);
  }

  async function runPolicySimulation() {
    if (!selectedCategoryId || !simulatePrompt.trim()) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setNotice(null);
    setActionBusy(true);
    try {
      const result = await simulateCategoryPolicy(selectedCategoryId, {
        prompt: simulatePrompt,
        top_k_override: policyForm.retrieval_top_k,
      });
      setSimulateResult({
        answer: result.answer,
        confidence: result.confidence,
        version: result.applied_policy_version,
        topK: result.applied_top_k,
      });
      setNotice({ type: "success", message: "Policy simulation complete." });
    } catch {
      setNotice({ type: "error", message: "Policy simulation failed." });
    }
    setActionBusy(false);
  }

  async function saveAutomation() {
    if (!selectedCategoryId) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    const keywords = automationForm.keywords
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setNotice(null);
    setActionBusy(true);
    try {
      await upsertCategoryAutomation(selectedCategoryId, {
        auto_categorization_enabled: automationForm.auto_categorization_enabled,
        keywords,
        confidence_threshold: automationForm.confidence_threshold,
      });
      await refreshTree();
      setNotice({ type: "success", message: "Automation settings saved." });
    } catch {
      setNotice({ type: "error", message: "Failed to save automation settings." });
    }
    setActionBusy(false);
  }

  async function runAutoCategorizeNow(sourceId: string) {
    if (!sourceId.trim()) return;
    if (!canManageCategories) {
      setNotice({
        type: "error",
        message: "Category management is locked by Superadmin for this tenant.",
      });
      return;
    }
    setNotice(null);
    setActionBusy(true);
    try {
      const result = await runAutoCategorization(sourceId.trim());
      setAutomationResult(
        `Matched ${result.matched_category_ids.length} categories, linked ${result.linked_count}.`,
      );
      if (selectedCategoryId) {
        await listCategoryKnowledgeSources(selectedCategoryId)
          .then(setCategoryDocs)
          .catch(() => {});
      }
      await refreshTree();
      setNotice({ type: "success", message: "Auto-categorization finished." });
    } catch {
      setNotice({ type: "error", message: "Auto-categorization failed." });
    }
    setActionBusy(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Categories Governance</h2>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          disabled={actionBusy || loading || !canManageCategories}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "New Category"}
        </button>
      </div>
      {!canManageCategories && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Categories are managed by Superadmin for this tenant. You can view, but editing is locked.
        </div>
      )}
      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.message}
        </div>
      )}
      {isBusy && (
        <p className="mb-4 text-xs text-gray-500" aria-live="polite">
          Refreshing categories...
        </p>
      )}

      {showForm && canManageCategories && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-6 grid grid-cols-2 gap-4"
        >
          <div className="col-span-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
            <p className="font-medium">How to create a category</p>
            <p>
              <strong>Name:</strong> Display label visible to admins and users.
            </p>
            <p>
              <strong>Parent:</strong> Choose Root for top-level category or nest under an existing path.
            </p>
            <p>
              <strong>Description/Icon:</strong> Optional metadata for organization and quick recognition.
            </p>
          </div>
          <label>
            <span className="text-sm text-gray-600">Name</span>
            <p className="mt-1 text-xs text-gray-500">Slug is auto-generated from this name.</p>
            <input
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, ""),
                })
              }
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Company Info"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Icon</span>
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="book-open"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Parent</span>
            <p className="mt-1 text-xs text-gray-500">Select a parent only if this is a sub-category.</p>
            <select
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Root</option>
              {allCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.path}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className="text-sm text-gray-600">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Knowledge related to company profile, mission, and values"
            />
          </label>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Tree</h3>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search categories..."
            className="w-full mb-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Search categories"
          />
          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            ))}
            {filteredTree.length === 0 && (
              <p className="text-sm text-gray-400">No matching categories.</p>
            )}
          </div>
        </section>

        <section className={`lg:col-span-8 space-y-4 ${!canManageCategories ? "opacity-80" : ""}`}>
          {!selectedCategory && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-500">
              Select a category from the tree.
            </div>
          )}
          {selectedCategory && (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedCategory.name}</h3>
                    <p className="text-sm text-gray-500">{selectedCategory.path}</p>
                  </div>
                  <button
                    onClick={toggleActive}
                    disabled={actionBusy || !canManageCategories}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      selectedCategory.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {selectedCategory.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Meta
                    label="Linked docs"
                    value={String(selectedCategory.linked_knowledge_documents ?? 0)}
                  />
                  <Meta
                    label="Role grants"
                    value={String(selectedCategory.active_user_permissions ?? 0)}
                  />
                  <Meta
                    label="Last synced"
                    value={
                      selectedCategory.last_synced_at
                        ? new Date(selectedCategory.last_synced_at).toLocaleString()
                        : "Never"
                    }
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Visibility Matrix</h4>
                  <button
                    onClick={saveVisibility}
                    disabled={actionBusy || !canManageCategories}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md"
                  >
                    Save
                  </button>
                </div>
                <div className="space-y-2">
                  {visibilityRows.map((row, idx) => (
                    <div key={row.role} className="grid grid-cols-12 gap-2 items-center">
                      <p className="col-span-3 text-sm text-gray-700 font-medium">{row.role}</p>
                      <select
                        value={row.permission_level ?? "none"}
                        disabled={!canManageCategories}
                        onChange={(e) => {
                          const next = [...visibilityRows];
                          next[idx] = {
                            ...row,
                            permission_level: e.target
                              .value as CategoryRolePermissionUpsertItem["permission_level"],
                          };
                          setVisibilityRows(next);
                        }}
                        className="col-span-5 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="none">None</option>
                        <option value="view">View</option>
                        <option value="edit">Edit</option>
                        <option value="publish">Publish</option>
                      </select>
                      <label className="col-span-4 text-xs text-gray-600 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(row.inherits_to_children)}
                          disabled={!canManageCategories}
                          onChange={(e) => {
                            const next = [...visibilityRows];
                            next[idx] = { ...row, inherits_to_children: e.target.checked };
                            setVisibilityRows(next);
                          }}
                        />
                        Inherit
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Policy Engine</h4>
                  <button
                    onClick={savePolicy}
                    disabled={actionBusy || !canManageCategories}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md"
                  >
                    Save Policy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Define retrieval behavior for this category: instructions, result count, and quality filters.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="md:col-span-2">
                    <span className="text-sm text-gray-600">System Instructions</span>
                    <textarea
                      rows={4}
                      value={policyForm?.system_instructions ?? ""}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, system_instructions: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Answer only from approved category knowledge and cite evidence."
                    />
                  </label>
                  <label>
                    <span className="text-sm text-gray-600">Retrieval Top-K</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={policyForm?.retrieval_top_k ?? 4}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setPolicyForm({
                          ...policyForm,
                          retrieval_top_k: Number(e.target.value) || 1,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-sm text-gray-600">Min Score (optional)</span>
                    <input
                      value={policyForm?.min_score ?? ""}
                      disabled={!canManageCategories}
                      onChange={(e) => setPolicyForm({ ...policyForm, min_score: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="0.65"
                    />
                  </label>
                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={policyForm?.citation_required ?? false}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, citation_required: e.target.checked })
                      }
                    />
                    Require citations in answer
                  </label>
                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(policyForm?.is_active)}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, is_active: e.target.checked })
                      }
                    />
                    Policy active
                  </label>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Version: {policy?.version ?? 0}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <input
                      value={simulatePrompt}
                      disabled={!canManageCategories}
                      onChange={(e) => setSimulatePrompt(e.target.value)}
                      placeholder="Run a category-scoped simulation prompt..."
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      aria-label="Policy simulation prompt"
                    />
                    <button
                      onClick={runPolicySimulation}
                      disabled={actionBusy || !canManageCategories}
                      className="bg-gray-900 hover:bg-gray-800 text-white text-xs px-3 py-2 rounded-md"
                    >
                      Simulate
                    </button>
                  </div>
                  {simulateResult && (
                    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        v{simulateResult.version} • top_k {simulateResult.topK} • confidence{" "}
                        {(simulateResult.confidence * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-800 mt-1">{simulateResult.answer}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Auto-Categorization</h4>
                  <button
                    onClick={saveAutomation}
                    disabled={actionBusy || !canManageCategories}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md"
                  >
                    Save Automation
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Configure keyword-based auto-tagging for newly indexed knowledge sources.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={automationForm?.auto_categorization_enabled ?? false}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setAutomationForm({
                          ...automationForm,
                          auto_categorization_enabled: e.target.checked,
                        })
                      }
                    />
                    Enable auto-categorization
                  </label>
                  <label>
                    <span className="text-sm text-gray-600">Confidence threshold</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={automationForm?.confidence_threshold ?? 0.7}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setAutomationForm({
                          ...automationForm,
                          confidence_threshold: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="md:col-span-2">
                    <span className="text-sm text-gray-600">Keywords (comma-separated)</span>
                    <textarea
                      rows={2}
                      value={automationForm?.keywords ?? ""}
                      disabled={!canManageCategories}
                      onChange={(e) =>
                        setAutomationForm({ ...automationForm, keywords: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="hiring, interview, offer letter"
                    />
                  </label>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500">
                    Use the Auto-tag control on each source below to classify and link in one click.
                  </p>
                  {automationResult && (
                    <p className="text-xs text-gray-600 mt-2">{automationResult}</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Usage Analytics</h4>
                  <select
                    value={heatmapWindowDays}
                    onChange={(e) => setHeatmapWindowDays(Number(e.target.value))}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value={7}>7d</option>
                    <option value={30}>30d</option>
                    <option value={60}>60d</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {heatmap.map((point) => {
                    const scale = Math.max(...heatmap.map((entry) => entry.query_count), 1);
                    const widthPct = Math.max(6, Math.round((point.query_count / scale) * 100));
                    return (
                      <div key={point.category_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{point.category_name}</span>
                          <span className="text-gray-500">
                            Q {point.query_count} • Low {point.low_confidence_count} • Avg {(point.avg_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 rounded bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full ${point.low_confidence_count > 0 ? "bg-amber-500" : "bg-indigo-500"}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {heatmap.length === 0 && (
                    <p className="text-sm text-gray-400">
                      No category query telemetry yet. Run category policy simulations or category-scoped QA flows.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h4 className="font-semibold text-gray-900 mb-3">Bulk Move Documents</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label>
                    <span className="text-sm text-gray-600">Source IDs (comma-separated)</span>
                    <textarea
                      rows={3}
                      value={bulkSourceIds}
                      onChange={(e) => setBulkSourceIds(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-sm text-gray-600">Destination category</span>
                      <select
                        value={bulkTargetCategoryId}
                        onChange={(e) => setBulkTargetCategoryId(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {allCategories
                          .filter((cat) => cat.id !== selectedCategory.id)
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.path}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm text-gray-600">Mode</span>
                      <select
                        value={bulkMode}
                        onChange={(e) => setBulkMode(e.target.value as "move" | "copy")}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="move">Move</option>
                        <option value="copy">Copy</option>
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => runBulkMove(true)}
                        disabled={actionBusy || !canManageCategories}
                        className="border border-gray-300 bg-white px-3 py-2 text-xs rounded-md"
                      >
                        Dry Run
                      </button>
                      <button
                        onClick={() => runBulkMove(false)}
                        disabled={actionBusy || !canManageCategories}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 text-xs rounded-md"
                      >
                        Apply
                      </button>
                    </div>
                    {bulkResult && <p className="text-xs text-gray-600">{bulkResult}</p>}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h4 className="font-semibold text-gray-900 mb-3">Linked Knowledge Sources</h4>
                <div className="space-y-2">
                  {categoryDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                        <p className="text-xs text-gray-500">
                          {doc.source_type} • {doc.status} • Chunks {doc.chunk_count}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{doc.id.slice(0, 8)}</p>
                        <button
                          onClick={() => runAutoCategorizeNow(doc.id)}
                          disabled={actionBusy || !canManageCategories}
                          className="text-xs bg-gray-900 text-white rounded px-2 py-1 hover:bg-gray-800"
                        >
                          Auto-tag
                        </button>
                      </div>
                    </div>
                  ))}
                  {categoryDocs.length === 0 && (
                    <p className="text-sm text-gray-400">No linked knowledge sources.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function flattenTree(nodes: CategoryTreeNodeResponse[]): CategoryTreeNodeResponse[] {
  const output: CategoryTreeNodeResponse[] = [];
  const walk = (node: CategoryTreeNodeResponse) => {
    if (!node) return;
    output.push(node);
    (node.children ?? []).forEach(walk);
  };
  (nodes ?? []).forEach(walk);
  return output;
}

function filterTree(nodes: CategoryTreeNodeResponse[], query: string): CategoryTreeNodeResponse[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes ?? [];
  const walk = (node: CategoryTreeNodeResponse): CategoryTreeNodeResponse | null => {
    if (!node) return null;
    const childMatches = (node.children ?? [])
      .map(walk)
      .filter((child): child is CategoryTreeNodeResponse => Boolean(child));
    const selfMatch =
      node.name.toLowerCase().includes(q) ||
      node.slug.toLowerCase().includes(q) ||
      (node.department ?? "").toLowerCase().includes(q);
    if (!selfMatch && childMatches.length === 0) return null;
    return { ...node, children: childMatches };
  };
  return (nodes ?? [])
    .map(walk)
    .filter((node): node is CategoryTreeNodeResponse => Boolean(node));
}

function TreeNode({
  node,
  selectedCategoryId,
  onSelect,
}: {
  node: CategoryTreeNodeResponse;
  selectedCategoryId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full text-left border rounded-md px-3 py-2 ${
          selectedCategoryId === node.id
            ? "border-indigo-300 bg-indigo-50"
            : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{node.name}</p>
            <p className="text-xs text-gray-500">{node.path}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">D: {node.linked_knowledge_documents ?? 0}</p>
            <p className="text-xs text-gray-600">P: {node.active_user_permissions ?? 0}</p>
          </div>
        </div>
      </button>
      {node.children.length > 0 && (
        <div className="ml-4 border-l border-gray-200 pl-3 space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedCategoryId={selectedCategoryId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
