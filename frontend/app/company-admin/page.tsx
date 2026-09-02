"use client";

import { useEffect, useState } from "react";
import {
  getStarterActions,
  listActions,
  listEmployees,
  listKnowledgeSources,
} from "../../lib/adminApi";
import type {
  ActionResponse,
  EmployeeProfileResponse,
  KnowledgeSourceResponse,
} from "../../lib/adminTypes";

export default function CompanyDashboardPage() {
  const [starters, setStarters] = useState<ActionResponse[]>([]);
  const [totalActions, setTotalActions] = useState(0);
  const [totalKb, setTotalKb] = useState(0);
  const [totalEmp, setTotalEmp] = useState(0);

  useEffect(() => {
    getStarterActions()
      .then((r: any) => {
        if (Array.isArray(r)) setStarters(r);
        else if (r && Array.isArray(r.actions)) setStarters(r.actions);
        else setStarters([]);
      })
      .catch(() => setStarters([]));
    listActions()
      .then((a: any) => setTotalActions(Array.isArray(a) ? a.length : 0))
      .catch(() => setTotalActions(0));
    listKnowledgeSources()
      .then((s: any) => setTotalKb(Array.isArray(s) ? s.length : 0))
      .catch(() => setTotalKb(0));
    listEmployees()
      .then((e: any) => setTotalEmp(Array.isArray(e) ? e.length : 0))
      .catch(() => setTotalEmp(0));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Actions" value={totalActions} />
        <StatCard label="KB Sources" value={totalKb} />
        <StatCard label="Employees" value={totalEmp} />
      </div>

      <h3 className="text-lg font-medium text-gray-800 mb-3">
        Current Top 4 Starter Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {starters.map((a, idx) => (
          <div
            key={a.id}
            className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold shrink-0">
              {idx + 1}
            </span>
            <div>
              <h4 className="font-medium text-gray-900">{a.title}</h4>
              <p className="text-sm text-gray-500">{a.description}</p>
              <div className="flex gap-3 mt-1 text-xs text-gray-400">
                <span>Clicks: {a.click_count}</span>
                {a.is_pinned && (
                  <span className="text-indigo-500">Pinned</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {starters.length === 0 && (
          <p className="text-gray-400 text-sm col-span-2">
            No starter actions configured. Create actions and pin them.
          </p>
        )}
      </div>
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
