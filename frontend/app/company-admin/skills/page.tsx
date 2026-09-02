"use client";

import { useEffect, useState } from "react";
import {
  getSkillUsageTimeseries,
  listSkillConfigs,
  simulateSkillConfig,
  upsertSkillConfig,
} from "../../../lib/adminApi";
import type {
  SkillConfigResponse,
  SkillConfigSimulateResponse,
  SkillUsageTimeseriesResponse,
} from "../../../lib/adminTypes";

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function iconForSkill(iconKey?: string): string {
  const map: Record<string, string> = {
    messages: "💬",
    library: "📚",
    sparkles: "✨",
    users: "👥",
    languages: "🌍",
    shield: "🛡️",
    history: "🕰️",
  };
  return map[iconKey ?? "sparkles"] ?? "⚙️";
}

function tierLabel(value?: string): string {
  const normalized = (value ?? "starter").toLowerCase();
  if (normalized === "enterprise") return "Enterprise";
  if (normalized === "growth") return "Growth";
  return "Starter";
}

function statusClass(status?: string): string {
  if (status === "Beta") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "Deprecated") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function buildSparklinePoints(counts: number[]): number[] {
  if (counts.length === 0) return [];
  const maxValue = Math.max(...counts, 1);
  return counts.map((count) => Math.max(0.08, count / maxValue));
}

function sparklinePath(points: number[], width = 120, height = 36): string {
  if (points.length === 0) return "";
  const stepX = width / (points.length - 1);
  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - point * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function SkillConfigsPage() {
  const [governanceRunId, setGovernanceRunId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<SkillConfigResponse[]>([]);
  const [timeseriesBySkill, setTimeseriesBySkill] = useState<
    Record<string, number[]>
  >({});
  const [selected, setSelected] = useState<SkillConfigResponse | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({});
  const [temperature, setTemperature] = useState(0.2);
  const [retrievalDepth, setRetrievalDepth] = useState(8);
  const [simulatePrompt, setSimulatePrompt] = useState(
    "Match Python backend profiles to this role description.",
  );
  const [simulateResult, setSimulateResult] =
    useState<SkillConfigSimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = new URL(window.location.href).searchParams.get("runId");
      setGovernanceRunId(id);
    }
  }, []);

  useEffect(() => {
    Promise.all([listSkillConfigs(), getSkillUsageTimeseries(7)])
      .then(([skillConfigs, timeseries]) => {
        setConfigs(skillConfigs);
        const next: Record<string, number[]> = {};
        timeseries.forEach((row: SkillUsageTimeseriesResponse) => {
          next[row.skill_type] = row.points.map((point) => point.count);
        });
        setTimeseriesBySkill(next);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function toggleEnabled(cfg: SkillConfigResponse) {
    if (cfg.is_locked) return;
    const updated = await upsertSkillConfig({
      template_id: cfg.template_id,
      config_overrides: cfg.config_overrides ?? {},
      is_enabled: !cfg.is_enabled,
    });
    setConfigs((prev) =>
      prev.map((c) => (c.template_id === cfg.template_id ? updated : c)),
    );
  }

  function openConfig(cfg: SkillConfigResponse) {
    const overrides = { ...(cfg.config_overrides ?? {}) };
    setSelected(cfg);
    setConfigDraft(overrides);
    setTemperature(toNumber(overrides.temperature, 0.2));
    setRetrievalDepth(toNumber(overrides.retrieval_depth, 8));
    setSimulateResult(null);
  }

  async function saveConfiguration() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const overrides: Record<string, unknown> = {
        ...configDraft,
        temperature,
        retrieval_depth: retrievalDepth,
      };
      const updated = await upsertSkillConfig({
        template_id: selected.template_id,
        is_enabled: selected.is_enabled,
        config_overrides: overrides,
      });
      setConfigs((prev) =>
        prev.map((c) => (c.template_id === selected.template_id ? updated : c)),
      );
      setSelected(updated);
      setConfigDraft(updated.config_overrides ?? {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runSimulation() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await simulateSkillConfig(selected.template_id, {
        prompt: simulatePrompt,
        config_overrides: {
          ...configDraft,
          temperature,
          retrieval_depth: retrievalDepth,
        },
      });
      setSimulateResult(resp);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Skills Configuration
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        AI App Store for tenant-level automation. Configure each skill before
        enabling company-wide rollout.
      </p>
      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {governanceRunId && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
          <p className="font-medium">Governance deep link</p>
          <p className="mt-1 text-indigo-800">
            A platform policy alert referenced skill run{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">{governanceRunId}</code>
            . Review recent runs in Audit Logs and cross-check orchestration settings below.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {configs.map((cfg) => (
          <div
            key={cfg.template_id}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {iconForSkill(cfg.icon_key)}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {cfg.template_name ?? cfg.template_id}
                  </h3>
                  <p
                    className="text-xs text-gray-500 mt-0.5"
                    title={cfg.tooltip ?? ""}
                  >
                    {cfg.tooltip || "No tooltip available."}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-1 border rounded-full ${statusClass(cfg.status)}`}
              >
                {cfg.status ?? "Stable"}
              </span>
            </div>

            <p className="text-sm text-gray-600 min-h-10">
              {cfg.template_description ?? "No description available."}
            </p>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                Tier: <span className="font-medium">{tierLabel(cfg.subscription_tier_required)}</span>
              </span>
              <span>
                Tenant: <span className="font-medium">{tierLabel(cfg.tenant_subscription_tier)}</span>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-xs">
              <div>
                <div className="text-gray-500">API</div>
                <div className="font-semibold text-gray-800">
                  {cfg.api_consumption_30d ?? 0}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Success</div>
                <div className="font-semibold text-gray-800">
                  {Math.round((cfg.success_rate_30d ?? 0) * 100)}%
                </div>
              </div>
              <div>
                <div className="text-gray-500">Latency</div>
                <div className="font-semibold text-gray-800">
                  {Math.round(cfg.avg_latency_ms_30d ?? 0)}ms
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-gray-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-500">
                  7-day usage trend
                </span>
                <span className="text-[11px] text-gray-400">Last 7 days</span>
              </div>
              <svg
                viewBox="0 0 120 36"
                className="mt-2 h-9 w-full"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d={sparklinePath(
                    buildSparklinePoints(
                      timeseriesBySkill[cfg.skill_type ?? ""] ?? [
                        0, 0, 0, 0, 0, 0, 0,
                      ],
                    ),
                  )}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => toggleEnabled(cfg)}
                disabled={Boolean(cfg.is_locked)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${
                  cfg.is_enabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cfg.is_locked
                  ? `Locked (${tierLabel(cfg.subscription_tier_required)})`
                  : cfg.is_enabled
                    ? "Enabled"
                    : "Disabled"}
              </button>

              <button
                onClick={() => openConfig(cfg)}
                className="text-xs px-3 py-1 rounded-full font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                Configuration
              </button>
            </div>

            {cfg.simulation_preview && (
              <p className="mt-3 text-xs text-gray-500">{cfg.simulation_preview}</p>
            )}
          </div>
        ))}
        {configs.length === 0 && (
          <p className="text-gray-400 text-sm">
            Skill configs are provisioned when your company account is created.
          </p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelected(null)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-gray-200 p-6 overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selected.template_name}
                </h3>
                <p className="text-sm text-gray-500">
                  Fine-tune parameters and run a dry-run simulation before rollout.
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">AI Temperature</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="text-xs text-gray-500 mt-1">{temperature.toFixed(2)}</div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Data Retrieval Depth</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={retrievalDepth}
                  onChange={(e) => setRetrievalDepth(Number(e.target.value))}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Simulate Prompt</span>
                <textarea
                  value={simulatePrompt}
                  onChange={(e) => setSimulatePrompt(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-24"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={saveConfiguration}
                disabled={loading || Boolean(selected.is_locked)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Save Configuration
              </button>
              <button
                onClick={runSimulation}
                disabled={loading}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Simulate
              </button>
            </div>

            {simulateResult && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-semibold text-gray-900">Simulation Output</h4>
                <p className="text-sm text-gray-600 mt-1">{simulateResult.summary}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Confidence: {(simulateResult.confidence * 100).toFixed(0)}%
                </p>
                <pre className="mt-3 rounded bg-white border border-gray-200 p-3 text-xs overflow-x-auto text-gray-700">
                  {JSON.stringify(simulateResult.sample_output, null, 2)}
                </pre>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
