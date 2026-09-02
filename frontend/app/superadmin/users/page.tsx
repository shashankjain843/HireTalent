"use client";

import { useEffect, useState } from "react";
import {
  createUser,
  listTenants,
  listUsers,
} from "../../../lib/adminApi";
import type { TenantResponse, UserResponse } from "../../../lib/adminTypes";

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "admin" as string,
    tenant_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "admin" | "editor" | "viewer">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    Promise.all([listUsers(), listTenants()])
      .then(([u, t]) => {
        setUsers(u);
        setTenants(t);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await createUser({
        ...form,
        tenant_id: form.tenant_id || undefined,
      });
      setUsers([u, ...users]);
      setShowForm(false);
      setForm({ email: "", password: "", name: "", role: "admin", tenant_id: "" });
    } catch {}
    setLoading(false);
  }

  const filtered = users
    .filter((u) => (roleFilter === "all" ? true : u.role === roleFilter))
    .filter((u) =>
      statusFilter === "all" ? true : statusFilter === "active" ? u.is_active : !u.is_active,
    )
    .filter((u) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const tenantName = u.tenant_id
        ? (tenants.find((t) => t.id === u.tenant_id)?.name ?? "").toLowerCase()
        : "platform";
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        tenantName.includes(q)
      );
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Users</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "New User"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-6 grid grid-cols-2 gap-4"
        >
          <label>
            <span className="text-sm text-gray-600">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label>
            <span className="text-sm text-gray-600">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <label className="col-span-2">
            <span className="text-sm text-gray-600">
              Tenant (leave empty for superadmin users)
            </span>
            <select
              value={form.tenant_id}
              onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No tenant (platform-level)</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              Create User
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, email, role..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as typeof roleFilter);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          <option value="superadmin">Superadmin</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="text-xs text-gray-500 self-center justify-self-end">
          {filtered.length} users
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialLoading &&
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-40 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-2 w-2 bg-gray-200 rounded-full animate-pulse" /></td>
                </tr>
              ))}
            {paged.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.tenant_id
                    ? tenants.find((t) => t.id === u.tenant_id)?.name ?? u.tenant_id
                    : "Platform"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${u.is_active ? "bg-green-500" : "bg-red-500"}`}
                  />
                </td>
              </tr>
            ))}
            {!initialLoading && paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No users yet
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
