"use client";

import { useEffect, useState } from "react";
import { getTenantHealth } from "../../lib/adminApi";
import type { TenantHealthResponse } from "../../lib/adminTypes";

export default function SuperadminDashboardPage() {
  const [health, setHealth] = useState<TenantHealthResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTenantHealth()
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Platform Dashboard
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Tenants" value={health.length} />
        <StatCard
          label="Total Skill Runs"
          value={health.reduce((s, h) => s + h.total_skill_runs, 0)}
        />
        <StatCard
          label="Avg Success Rate"
          value={
            health.length
              ? `${(
                  (health.reduce((s, h) => s + h.skill_success_rate, 0) /
                    health.length) *
                  100
                ).toFixed(1)}%`
              : "N/A"
          }
        />
      </div>

      <h3 className="text-lg font-medium text-gray-800 mb-3">Tenant Health</h3>
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : health.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No tenants yet. Create one from the Tenants page.
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Tenant
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  KB Sources
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Employees
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Skill Runs
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Success %
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Avg Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {health.map((h) => (
                <tr key={h.tenant_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {h.tenant_name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {h.total_actions}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {h.total_kb_sources}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {h.total_employees}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {h.total_skill_runs}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {(h.skill_success_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {h.avg_latency_ms.toFixed(0)}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
