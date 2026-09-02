"use client";

import { useEffect, useState } from "react";
import { listAuditLogs } from "../../../lib/adminApi";
import type { AuditLogResponse } from "../../../lib/adminTypes";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | "create" | "update" | "delete" | "other">("all");

  useEffect(() => {
    listAuditLogs(undefined, page)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const entityTypes = Array.from(new Set(logs.map((log) => log.entity_type).filter(Boolean)));
  const actionCounts = logs.reduce<Record<"create" | "update" | "delete" | "other", number>>(
    (acc, log) => {
      acc[getActionGroup(log.action)] += 1;
      return acc;
    },
    { create: 0, update: 0, delete: 0, other: 0 },
  );
  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
    if (actionFilter !== "all" && getActionGroup(log.action) !== actionFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.ip_address ?? "").toLowerCase().includes(q) ||
      (log.entity_id ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Audit Logs
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action, entity, IP, entity id..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All entities</option>
          {entityTypes.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 self-center justify-self-end">
          {filteredLogs.length} rows
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "All", count: logs.length },
          { key: "create", label: "Create", count: actionCounts.create },
          { key: "update", label: "Update", count: actionCounts.update },
          { key: "delete", label: "Delete", count: actionCounts.delete },
          { key: "other", label: "Other", count: actionCounts.other },
        ].map((chip) => {
          const active = actionFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() =>
                setActionFilter(
                  chip.key as "all" | "create" | "update" | "delete" | "other",
                )
              }
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                active
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {chip.label} ({chip.count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Time
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Action
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Entity
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                IP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading &&
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-3"><div className="h-3 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse" /></td>
                </tr>
              ))}
            {filteredLogs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {l.action}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {l.entity_type}
                  {l.entity_id && (
                    <span className="text-gray-400 ml-1 text-xs">
                      {l.entity_id.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {l.ip_address ?? "-"}
                </td>
              </tr>
            ))}
            {!loading && filteredLogs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No audit logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4 justify-end">
        <button
          disabled={page <= 1}
          onClick={() => {
            setLoading(true);
            setPage((p) => p - 1);
          }}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500 py-1.5">Page {page}</span>
        <button
          disabled={logs.length < 50}
          onClick={() => {
            setLoading(true);
            setPage((p) => p + 1);
          }}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function getActionGroup(action: string): "create" | "update" | "delete" | "other" {
  const normalized = action.toLowerCase();
  if (normalized.includes("create")) return "create";
  if (normalized.includes("update") || normalized.includes("edit") || normalized.includes("patch")) {
    return "update";
  }
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  return "other";
}
