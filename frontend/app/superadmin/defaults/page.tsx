"use client";

import { useEffect, useState } from "react";
import {
  deleteDefaultAction,
  deleteDefaultCategory,
  listDefaultActions,
  listDefaultCategories,
  updateDefaultAction,
  updateDefaultCategory,
} from "../../../lib/adminApi";
import type {
  ActionResponse,
  CategoryResponse,
} from "../../../lib/adminTypes";

export default function DefaultsPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [actions, setActions] = useState<ActionResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editing, setEditing] = useState<ActionResponse | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryResponse | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [editCategoryForm, setEditCategoryForm] = useState({
    name: "",
    description: "",
    icon: "",
    is_active: true,
    sort_order: 0,
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    prompt_template: "",
    icon: "",
    category_id: "",
    is_pinned: false,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteActionId, setDeleteActionId] = useState<string | null>(null);
  const [bulkDeletingCategories, setBulkDeletingCategories] = useState(false);
  const [bulkDeletingActions, setBulkDeletingActions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [duplicatesOnlyCategories, setDuplicatesOnlyCategories] = useState(false);
  const [duplicatesOnlyActions, setDuplicatesOnlyActions] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    Promise.all([listDefaultCategories(), listDefaultActions()])
      .then(([c, a]) => {
        setCategories(c);
        setActions(a);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  function startEdit(action: ActionResponse) {
    setEditing(action);
    setEditForm({
      title: action.title,
      description: action.description ?? "",
      prompt_template: action.prompt_template ?? "",
      icon: action.icon ?? "",
      category_id: action.category_id ?? "",
      is_pinned: action.is_pinned,
      is_active: action.is_active,
    });
  }

  function startEditCategory(category: CategoryResponse) {
    setEditingCategory(category);
    setEditCategoryForm({
      name: category.name,
      description: category.description ?? "",
      icon: category.icon ?? "",
      is_active: category.is_active,
      sort_order: category.sort_order,
    });
  }

  async function saveCategoryEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory) return;
    setCategoryLoading(true);
    try {
      const updated = await updateDefaultCategory(editingCategory.id, {
        name: editCategoryForm.name,
        description: editCategoryForm.description || undefined,
        icon: editCategoryForm.icon || undefined,
        is_active: editCategoryForm.is_active,
        sort_order: editCategoryForm.sort_order,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? updated : c)),
      );
      setEditingCategory(null);
    } finally {
      setCategoryLoading(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    try {
      const updated = await updateDefaultAction(editing.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        prompt_template: editForm.prompt_template || undefined,
        icon: editForm.icon || undefined,
        category_id: editForm.category_id || undefined,
        is_pinned: editForm.is_pinned,
        is_active: editForm.is_active,
      });
      setActions(actions.map((a) => (a.id === editing.id ? updated : a)));
      setEditing(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategory(category: CategoryResponse) {
    if (
      !window.confirm(
        `Delete default category "${category.name}"? This cannot be undone and only affects future tenant provisioning defaults.`,
      )
    ) {
      return;
    }
    setDeleteCategoryId(category.id);
    setError(null);
    setStatus(null);
    try {
      await deleteDefaultCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setActions((prev) => prev.filter((a) => a.category_id !== category.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete default category.";
      setError(message);
    } finally {
      setDeleteCategoryId(null);
    }
  }

  async function handleDeleteAction(action: ActionResponse) {
    if (
      !window.confirm(
        `Delete default action "${action.title}"? This cannot be undone and only affects future tenant provisioning defaults.`,
      )
    ) {
      return;
    }
    setDeleteActionId(action.id);
    setError(null);
    setStatus(null);
    try {
      await deleteDefaultAction(action.id);
      setActions((prev) => prev.filter((a) => a.id !== action.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete default action.";
      setError(message);
    } finally {
      setDeleteActionId(null);
    }
  }

  const categoryDuplicateCounts = categories.reduce<Record<string, number>>((acc, category) => {
    const key = `${category.slug.trim().toLowerCase()}|${category.name.trim().toLowerCase()}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const filteredCategories = duplicatesOnlyCategories
    ? categories.filter((category) => {
        const key = `${category.slug.trim().toLowerCase()}|${category.name.trim().toLowerCase()}`;
        return (categoryDuplicateCounts[key] ?? 0) > 1;
      })
    : categories;
  const sortedCategories = [...filteredCategories].sort((a, b) => {
    const keyA = `${a.slug.trim().toLowerCase()}|${a.name.trim().toLowerCase()}`;
    const keyB = `${b.slug.trim().toLowerCase()}|${b.name.trim().toLowerCase()}`;
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const actionDuplicateCounts = actions.reduce<Record<string, number>>((acc, action) => {
    const key = `${action.title.trim().toLowerCase()}|${(action.category_id ?? "").trim().toLowerCase()}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const filteredActions = actions
    .filter((a) => {
      if (!duplicatesOnlyActions) return true;
      const key = `${a.title.trim().toLowerCase()}|${(a.category_id ?? "").trim().toLowerCase()}`;
      return (actionDuplicateCounts[key] ?? 0) > 1;
    })
    .filter((a) =>
      statusFilter === "all" ? true : statusFilter === "active" ? a.is_active : !a.is_active,
    )
    .filter((a) =>
      pinnedFilter === "all" ? true : pinnedFilter === "pinned" ? a.is_pinned : !a.is_pinned,
    )
    .filter((a) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const catName = (categories.find((c) => c.id === a.category_id)?.name ?? "").toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        catName.includes(q)
      );
    });
  const sortedActions = [...filteredActions].sort((a, b) => {
    const keyA = `${a.title.trim().toLowerCase()}|${(a.category_id ?? "").trim().toLowerCase()}`;
    const keyB = `${b.title.trim().toLowerCase()}|${(b.category_id ?? "").trim().toLowerCase()}`;
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const totalPages = Math.max(1, Math.ceil(sortedActions.length / pageSize));
  const pagedActions = sortedActions.slice((page - 1) * pageSize, page * pageSize);

  async function handleBulkDeleteDuplicateActions() {
    setBulkDeletingActions(true);
    setError(null);
    setStatus(null);
    try {
      const seen = new Set<string>();
      const duplicatesToDelete = sortedActions.filter((action) => {
        const key = `${action.title.trim().toLowerCase()}|${(action.category_id ?? "").trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          return false;
        }
        return true;
      });

      for (const action of duplicatesToDelete) {
        await deleteDefaultAction(action.id);
      }
      if (duplicatesToDelete.length > 0) {
        const removeIds = new Set(duplicatesToDelete.map((action) => action.id));
        setActions((prev) => prev.filter((action) => !removeIds.has(action.id)));
      }
      setStatus(
        duplicatesToDelete.length > 0
          ? `Deleted ${duplicatesToDelete.length} duplicate default actions.`
          : "No duplicate default actions to delete.",
      );
      setPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to bulk delete duplicate actions.";
      setError(message);
    } finally {
      setBulkDeletingActions(false);
    }
  }

  async function handleBulkDeleteDuplicateCategories() {
    setBulkDeletingCategories(true);
    setError(null);
    setStatus(null);
    try {
      const groups = new Map<string, CategoryResponse[]>();
      for (const category of sortedCategories) {
        const key = `${category.slug.trim().toLowerCase()}|${category.name.trim().toLowerCase()}`;
        const group = groups.get(key) ?? [];
        group.push(category);
        groups.set(key, group);
      }

      const categoriesToDelete: CategoryResponse[] = [];
      const actionUpdates: Array<{ id: string; category_id: string }> = [];
      for (const [, group] of groups) {
        if (group.length < 2) continue;
        const [keep, ...remove] = group;
        categoriesToDelete.push(...remove);
        for (const action of actions) {
          if (remove.some((category) => category.id === action.category_id)) {
            actionUpdates.push({ id: action.id, category_id: keep.id });
          }
        }
      }

      for (const update of actionUpdates) {
        await updateDefaultAction(update.id, { category_id: update.category_id });
      }
      for (const category of categoriesToDelete) {
        await deleteDefaultCategory(category.id);
      }

      if (actionUpdates.length > 0) {
        const updateMap = new Map(actionUpdates.map((update) => [update.id, update.category_id]));
        setActions((prev) =>
          prev.map((action) => {
            const nextCategoryId = updateMap.get(action.id);
            return nextCategoryId ? { ...action, category_id: nextCategoryId } : action;
          }),
        );
      }
      if (categoriesToDelete.length > 0) {
        const removeIds = new Set(categoriesToDelete.map((category) => category.id));
        setCategories((prev) => prev.filter((category) => !removeIds.has(category.id)));
      }
      setStatus(
        categoriesToDelete.length > 0
          ? `Deleted ${categoriesToDelete.length} duplicate default categories and reassigned ${actionUpdates.length} actions.`
          : "No duplicate default categories to delete.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to bulk delete duplicate categories.";
      setError(message);
    } finally {
      setBulkDeletingCategories(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Global Defaults
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage templates copied to newly created tenants.
        </p>
      </div>
      <p className="text-sm text-gray-500">
        These categories and actions are copied to every new tenant on creation.
      </p>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}

      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Default Categories
      </h3>
      <div className="mb-3 flex items-center justify-end">
        <div className="inline-flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={duplicatesOnlyCategories}
              onChange={(e) => setDuplicatesOnlyCategories(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show duplicates only
          </label>
          <button
            onClick={() => void handleBulkDeleteDuplicateCategories()}
            disabled={bulkDeletingCategories}
            className="text-xs px-2.5 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {bulkDeletingCategories ? "Deleting..." : "Delete shown duplicates (keep first)"}
          </button>
          <span className="text-xs text-gray-500">Keeping oldest</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {sortedCategories.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                {c.icon && (
                  <span className="text-gray-400 text-sm">{c.icon}</span>
                )}
                <h4 className="font-medium text-gray-900">{c.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEditCategory(c)}
                  className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => void handleDeleteCategory(c)}
                  disabled={deleteCategoryId === c.id}
                  className="text-xs px-2.5 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleteCategoryId === c.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">{c.description}</p>
          </div>
        ))}
        {sortedCategories.length === 0 && (
          <p className="text-gray-400 text-sm col-span-2">
            {duplicatesOnlyCategories
              ? "No duplicate default categories found."
              : "Default categories are seeded on startup."}
          </p>
        )}
      </div>

      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Default Actions
      </h3>
      <div className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-2 shadow-sm">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search default actions..."
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
          {filteredActions.length} defaults
        </p>
      </div>
      <div className="mt-2 flex items-center justify-end">
        <div className="inline-flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={duplicatesOnlyActions}
              onChange={(e) => {
                setDuplicatesOnlyActions(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300"
            />
            Show duplicates only
          </label>
          <button
            onClick={() => void handleBulkDeleteDuplicateActions()}
            disabled={bulkDeletingActions}
            className="text-xs px-2.5 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {bulkDeletingActions ? "Deleting..." : "Delete shown duplicates (keep first)"}
          </button>
          <span className="text-xs text-gray-500">Keeping oldest</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Pinned</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialLoading &&
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-3"><div className="h-3 w-36 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse mx-auto" /></td>
                  <td className="px-4 py-3"><div className="h-6 w-12 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))}
            {pagedActions.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">{a.description}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {categories.find((c) => c.id === a.category_id)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_pinned ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.is_pinned ? "Pinned" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {a.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => startEdit(a)}
                      className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDeleteAction(a)}
                      disabled={deleteActionId === a.id}
                      className="text-xs px-2.5 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleteActionId === a.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!initialLoading && pagedActions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No matching default actions found.
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
            onSubmit={saveEdit}
            className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Default Action
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Changes apply to new tenant provisioning defaults.
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
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={saveCategoryEdit}
            className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Default Category
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Changes apply to new tenant provisioning defaults.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2">
                <span className="text-sm text-gray-600">Name</span>
                <input
                  value={editCategoryForm.name}
                  onChange={(e) =>
                    setEditCategoryForm({ ...editCategoryForm, name: e.target.value })
                  }
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="col-span-2">
                <span className="text-sm text-gray-600">Description</span>
                <input
                  value={editCategoryForm.description}
                  onChange={(e) =>
                    setEditCategoryForm({
                      ...editCategoryForm,
                      description: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Icon</span>
                <input
                  value={editCategoryForm.icon}
                  onChange={(e) =>
                    setEditCategoryForm({ ...editCategoryForm, icon: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label>
                <span className="text-sm text-gray-600">Sort order</span>
                <input
                  type="number"
                  value={editCategoryForm.sort_order}
                  onChange={(e) =>
                    setEditCategoryForm({
                      ...editCategoryForm,
                      sort_order: Number(e.target.value) || 0,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editCategoryForm.is_active}
                  onChange={(e) =>
                    setEditCategoryForm({
                      ...editCategoryForm,
                      is_active: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={categoryLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {categoryLoading ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
