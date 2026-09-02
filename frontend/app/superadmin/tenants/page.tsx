"use client";

import { useEffect, useState } from "react";
import {
  createTenant,
  listTenants,
  updateTenant,
} from "../../../lib/adminApi";
import type { TenantResponse } from "../../../lib/adminTypes";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"name" | "created">("created");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  function isTenantWidgetBehaviorEditEnabled(t: TenantResponse): boolean {
    const settings = (t.settings as Record<string, unknown> | null) ?? {};
    const raw = settings.allow_tenant_widget_behavior_edit;
    return raw === undefined ? true : Boolean(raw);
  }

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const t = await createTenant({ name, slug });
      setTenants([t, ...tenants]);
      setShowForm(false);
      setName("");
      setSlug("");
    } catch {}
    setLoading(false);
  }

  async function toggleStatus(t: TenantResponse) {
    const next = t.status === "active" ? "suspended" : "active";
    const updated = await updateTenant(t.id, { status: next });
    setTenants(tenants.map((x) => (x.id === t.id ? updated : x)));
  }

  async function toggleWidgetBehaviorEditAccess(t: TenantResponse) {
    const settings = (t.settings as Record<string, unknown> | null) ?? {};
    const current = isTenantWidgetBehaviorEditEnabled(t);
    const updated = await updateTenant(t.id, {
      settings: {
        ...settings,
        allow_tenant_widget_behavior_edit: !current,
      },
    });
    setTenants(tenants.map((x) => (x.id === t.id ? updated : x)));
  }

  async function toggleStarterCandidateVisibility(t: TenantResponse) {
    const settings = (t.settings as Record<string, unknown> | null) ?? {};
    const current = Boolean(settings.include_starter_candidates);
    const updated = await updateTenant(t.id, {
      settings: {
        ...settings,
        include_starter_candidates: !current,
      },
    });
    setTenants(tenants.map((x) => (x.id === t.id ? updated : x)));
  }

  const filtered = tenants
    .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
    .filter((t) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Tenants</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "New Tenant"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-6 flex gap-3 items-end"
        >
          <label className="flex-1">
            <span className="text-sm text-gray-600">Name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, ""),
                );
              }}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Acme Corp"
            />
          </label>
          <label className="flex-1">
            <span className="text-sm text-gray-600">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="^[a-z0-9\-]+$"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="acme-corp"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search tenant name or slug..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "suspended");
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "created")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="created">Sort: newest first</option>
          <option value="name">Sort: name A-Z</option>
        </select>
        <div className="text-xs text-gray-500 self-center justify-self-end">
          {filtered.length} tenants
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Slug
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Created
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Tenant Widget Edit
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Starter Candidates
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialLoading &&
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-3">
                    <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))}
            {paged.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {t.name}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {t.slug}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void toggleWidgetBehaviorEditAccess(t)}
                    className={`text-xs rounded-full px-2.5 py-1 border ${
                      isTenantWidgetBehaviorEditEnabled(t)
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-zinc-50 text-zinc-700 border-zinc-200"
                    }`}
                  >
                    {isTenantWidgetBehaviorEditEnabled(t)
                      ? "Enabled"
                      : "Disabled"}
                  </button>
                </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void toggleStarterCandidateVisibility(t)}
                      className={`text-xs rounded-full px-2.5 py-1 border ${
                        Boolean(
                          (t.settings as Record<string, unknown> | null)
                            ?.include_starter_candidates,
                        )
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-zinc-50 text-zinc-700 border-zinc-200"
                      }`}
                    >
                      {Boolean(
                        (t.settings as Record<string, unknown> | null)
                          ?.include_starter_candidates,
                      )
                        ? "Visible"
                        : "Hidden"}
                    </button>
                  </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleStatus(t)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    {t.status === "active" ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {!initialLoading && paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No tenants yet
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
    </div>
  );
}
