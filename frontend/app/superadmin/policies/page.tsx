"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  FileDiff,
  Gavel,
  Layers,
  Radio,
  Shield,
} from "lucide-react";
import {
  createGlobalPolicy,
  downloadComplianceReportPdf,
  getGovernanceOverview,
  listGlobalPolicies,
  listPolicyRevisions,
  listPolicyViolations,
  listTenants,
  updateGlobalPolicy,
} from "../../../lib/adminApi";
import type {
  GovernanceOverviewResponse,
  PolicyFleetStatusItem,
  PolicyRuleResponse,
  PolicyRuleRevisionResponse,
  PolicyViolationResponse,
  TenantResponse,
} from "../../../lib/adminTypes";

const RULE_TYPES = [
  { value: "content_filter", label: "Content filter" },
  { value: "pii_scan", label: "PII scan" },
  { value: "moderation", label: "Moderation" },
  { value: "hallucination_guardrail", label: "Hallucination guardrails" },
  { value: "token_budget", label: "Token budgeting" },
  { value: "bias_mitigation", label: "Bias mitigation (matching)" },
] as const;

const TIERS = ["starter", "growth", "enterprise"] as const;
const REGIONS = ["US", "EU", "APAC", "LATAM", "GLOBAL"] as const;

function statusDotClass(status: string): string {
  if (status === "critical") return "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]";
  if (status === "watch") return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]";
  return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]";
}

function healthBarColor(score: number): string {
  if (score >= 82) return "from-emerald-500 to-teal-400";
  if (score >= 55) return "from-amber-500 to-yellow-400";
  return "from-rose-600 to-orange-500";
}

function violationResourceLabel(resourceType: string): string {
  const map: Record<string, string> = {
    category: "Category policy",
    knowledge_source: "KB document",
    knowledge_chunk: "KB chunk",
    chat_action: "Chat action",
    skill_run: "Skill run",
  };
  return map[resourceType] ?? resourceType;
}

function simpleLineDiff(a: string, b: string): { line: string; kind: "same" | "add" | "del" }[] {
  const la = a.split("\n");
  const lb = b.split("\n");
  const max = Math.max(la.length, lb.length);
  const out: { line: string; kind: "same" | "add" | "del" }[] = [];
  for (let i = 0; i < max; i++) {
    const x = la[i];
    const y = lb[i];
    if (x === y) out.push({ line: x ?? "", kind: "same" });
    else {
      if (x !== undefined) out.push({ line: x, kind: "del" });
      if (y !== undefined) out.push({ line: y, kind: "add" });
    }
  }
  return out;
}

export default function PoliciesPage() {
  const [overview, setOverview] = useState<GovernanceOverviewResponse | null>(null);
  const [policies, setPolicies] = useState<PolicyRuleResponse[]>([]);
  const [violations, setViolations] = useState<PolicyViolationResponse[]>([]);
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [reportTenantId, setReportTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    rule_type: "content_filter",
    is_required: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState({
    enforcement_mode: "strict_block" as "monitor" | "strict_block",
    safety_prompt: "",
    tenant_tiers: [] as string[],
    regions: [] as string[],
  });
  const [revisions, setRevisions] = useState<PolicyRuleRevisionResponse[]>([]);
  const [compare, setCompare] = useState<{ left: number; right: number } | null>(null);

  const selected = useMemo(
    () => policies.find((p) => p.id === selectedId) ?? null,
    [policies, selectedId],
  );

  const fleetById = useMemo(() => {
    const m = new Map<string, PolicyFleetStatusItem>();
    overview?.fleet.forEach((f) => m.set(f.policy_id, f));
    return m;
  }, [overview]);

  async function refresh() {
    setError(null);
    try {
      const [o, p, v, t] = await Promise.all([
        getGovernanceOverview(),
        listGlobalPolicies(),
        listPolicyViolations(150),
        listTenants(),
      ]);
      setOverview(o);
      setPolicies(p);
      setViolations(v);
      setTenants(t);
      setReportTenantId((prev) => prev || (t[0]?.id ?? ""));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const [o, p, v, t] = await Promise.all([
          getGovernanceOverview(),
          listGlobalPolicies(),
          listPolicyViolations(150),
          listTenants(),
        ]);
        if (cancelled) return;
        setOverview(o);
        setPolicies(p);
        setViolations(v);
        setTenants(t);
        setReportTenantId((prev) => prev || (t[0]?.id ?? ""));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function hydrateEditorFromPolicy(p: PolicyRuleResponse) {
    const cfg = (p.config ?? {}) as Record<string, unknown>;
    const logic = (cfg.conditional_logic ?? {}) as Record<string, unknown>;
    setEditor({
      enforcement_mode:
        cfg.enforcement_mode === "monitor" ? "monitor" : "strict_block",
      safety_prompt: String(cfg.safety_prompt ?? ""),
      tenant_tiers: Array.isArray(logic.tenant_tiers)
        ? (logic.tenant_tiers as string[]).map(String)
        : [],
      regions: Array.isArray(logic.regions) ? (logic.regions as string[]).map(String) : [],
    });
    void listPolicyRevisions(p.id)
      .then(setRevisions)
      .catch(() => setRevisions([]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const p = await createGlobalPolicy({
        name: form.name,
        rule_type: form.rule_type,
        is_required: form.is_required,
        config: {
          enforcement_mode: "monitor",
          safety_prompt: "",
          conditional_logic: { tenant_tiers: [], regions: [] },
        },
      });
      setPolicies([p, ...policies]);
      setShowForm(false);
      setForm({ name: "", rule_type: "content_filter", is_required: false });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  async function savePolicyEdits() {
    if (!selected) return;
    setLoading(true);
    try {
      const cfg = {
        ...(selected.config ?? {}),
        enforcement_mode: editor.enforcement_mode,
        safety_prompt: editor.safety_prompt,
        conditional_logic: {
          tenant_tiers: editor.tenant_tiers,
          regions: editor.regions,
        },
      };
      const updated = await updateGlobalPolicy(selected.id, { config: cfg });
      setPolicies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      hydrateEditorFromPolicy(updated);
      await refresh();
      const revs = await listPolicyRevisions(selected.id);
      setRevisions(revs);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  async function togglePolicyActive(p: PolicyRuleResponse) {
    setLoading(true);
    try {
      const updated = await updateGlobalPolicy(p.id, { is_active: !p.is_active });
      setPolicies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  async function handleDownloadPdf() {
    if (!reportTenantId) return;
    setLoading(true);
    try {
      const blob = await downloadComplianceReportPdf(reportTenantId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `governance-audit-${reportTenantId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  function toggleTier(tier: string) {
    setEditor((e) => ({
      ...e,
      tenant_tiers: e.tenant_tiers.includes(tier)
        ? e.tenant_tiers.filter((x) => x !== tier)
        : [...e.tenant_tiers, tier],
    }));
  }

  function toggleRegion(r: string) {
    setEditor((e) => ({
      ...e,
      regions: e.regions.includes(r) ? e.regions.filter((x) => x !== r) : [...e.regions, r],
    }));
  }

  const compareRows = useMemo(() => {
    if (!compare || revisions.length === 0) return [];
    const a = revisions.find((r) => r.version === compare.left);
    const b = revisions.find((r) => r.version === compare.right);
    if (!a || !b) return [];
    const sa = a.safety_prompt_snapshot || "";
    const sb = b.safety_prompt_snapshot || "";
    return simpleLineDiff(sa, sb);
  }, [compare, revisions]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/90">
              Security Command Center
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              AI Governance Framework
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Live posture across hallucination controls, token budgets, bias mitigation, and
              enforcement modes. Superadmin tools for tenant targeting, violation tracing, and
              audit-ready exports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/10"
            >
              <Radio className="h-4 w-4" aria-hidden />
              Refresh telemetry
            </button>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-400"
            >
              <Layers className="h-4 w-4" aria-hidden />
              {showForm ? "Close designer" : "New governance control"}
            </button>
          </div>
        </div>

        {overview && (
          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Active threats</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{overview.active_threats}</p>
              <p className="text-xs text-slate-400">Critical-severity signals (24h)</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-amber-200">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Violations (24h)</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {overview.open_violations_24h}
              </p>
              <p className="text-xs text-slate-400">All policy classes, all tenants</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-emerald-200">
                <Gavel className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Strict blocking</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {overview.policies_in_strict_block}
              </p>
              <p className="text-xs text-slate-400">Controls that halt unsafe runs</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sky-200">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Monitor only</span>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {overview.policies_in_monitor}
              </p>
              <p className="text-xs text-slate-400">Observe + log without blocking</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-900">Create control</h3>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="min-w-[200px] flex-1">
              <span className="text-xs font-medium text-gray-600">Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="min-w-[220px]">
              <span className="text-xs font-medium text-gray-600">Governance class</span>
              <select
                value={form.rule_type}
                onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {RULE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Required baseline</span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Policy fleet health
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((p) => {
            const f = fleetById.get(p.id);
            const score = f?.health_score ?? 100;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  hydrateEditorFromPolicy(p);
                }}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md ${
                  selectedId === p.id ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {p.rule_type} · v{p.version}{" "}
                      <span className="text-gray-400">
                        · {f?.enforcement_mode === "monitor" ? "Monitor" : "Strict"}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(f?.status ?? "healthy")}`}
                    title={f?.status ?? "healthy"}
                  />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Health score</span>
                    <span className="font-semibold tabular-nums text-gray-800">{score}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${healthBarColor(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-gray-400">
                    <span>24h: {f?.violation_count_24h ?? 0}</span>
                    <span>7d: {f?.violation_count_7d ?? 0}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.is_required && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Required
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.is_active ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.is_active ? "Live" : "Paused"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Enforcement & targeting</h3>
            <p className="mt-1 text-xs text-gray-500">
              Toggle the enforcement engine between observe-only and full blocking for this control.
            </p>
            <div className="mt-4 flex gap-2 rounded-lg bg-gray-100 p-1">
              {(["monitor", "strict_block"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEditor((e) => ({ ...e, enforcement_mode: mode }))}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    editor.enforcement_mode === mode
                      ? "bg-white text-gray-900 shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {mode === "monitor" ? "Monitor only" : "Strict blocking"}
                </button>
              ))}
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-medium text-gray-600">Safety / system prompt delta</span>
              <textarea
                value={editor.safety_prompt}
                onChange={(e) => setEditor({ ...editor, safety_prompt: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Instructions merged into orchestration for this policy class..."
              />
            </label>
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-600">Conditional logic — tenant tiers</p>
              <p className="text-[11px] text-gray-500">
                Empty selection means all tiers. Otherwise policy applies only to selected plans.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleTier(tier)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                      editor.tenant_tiers.includes(tier)
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-600">Geographic scope</p>
              <p className="text-[11px] text-gray-500">
                Match against{" "}
                <code className="rounded bg-gray-100 px-1">tenant.settings.data_region</code> (or{" "}
                <code className="rounded bg-gray-100 px-1">region</code>). Include GLOBAL to match
                all.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRegion(r)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      editor.regions.includes(r)
                        ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => savePolicyEdits()}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save governance config
              </button>
              <button
                type="button"
                onClick={() => togglePolicyActive(selected)}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800"
              >
                {selected.is_active ? "Pause control" : "Activate control"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (revisions.length >= 2) {
                    const sorted = [...revisions].sort((a, b) => b.version - a.version);
                    setCompare({ left: sorted[1].version, right: sorted[0].version });
                  }
                }}
                disabled={revisions.length < 2}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 disabled:opacity-40"
              >
                <FileDiff className="h-4 w-4" aria-hidden />
                Compare latest versions
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Raw policy config</h3>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(selected.config ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      )}

      {compare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Safety prompt version comparison</h3>
              <button
                type="button"
                onClick={() => setCompare(null)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="text-gray-500">Version A</span>
                <select
                  value={compare.left}
                  onChange={(e) =>
                    setCompare((c) => (c ? { ...c, left: Number(e.target.value) } : c))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {revisions.map((r) => (
                    <option key={r.id} value={r.version}>
                      v{r.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-gray-500">Version B</span>
                <select
                  value={compare.right}
                  onChange={(e) =>
                    setCompare((c) => (c ? { ...c, right: Number(e.target.value) } : c))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {revisions.map((r) => (
                    <option key={r.id} value={r.version}>
                      v{r.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="max-h-[55vh] overflow-auto p-4 font-mono text-xs">
              {compareRows.length === 0 ? (
                <p className="text-gray-500">Select two versions with differing safety prompts.</p>
              ) : (
                compareRows.map((row, i) => (
                  <div
                    key={`${row.kind}-${i}`}
                    className={
                      row.kind === "same"
                        ? "text-gray-700"
                        : row.kind === "add"
                          ? "bg-emerald-50 text-emerald-900"
                          : "bg-rose-50 text-rose-900 line-through"
                    }
                  >
                    {row.line || " "}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Compliance reporting</h3>
            <p className="text-xs text-gray-500">
              Tenant-scoped PDF summaries for audits (violations sample + global policy inventory).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reportTenantId}
              onChange={(e) => setReportTenantId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDownloadPdf()}
              disabled={!reportTenantId || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Policy violation log</h3>
          <p className="text-xs text-gray-500">
            Deep links resolve to company-admin surfaces (e.g. skill runs) for investigator context.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Time (UTC)</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Message</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Trace</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">
                    {v.created_at?.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        v.severity === "critical"
                          ? "bg-rose-100 text-rose-800"
                          : v.severity === "high"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-800">{v.violation_type}</td>
                  <td className="max-w-md px-4 py-2 text-xs text-gray-700">{v.message}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{v.enforcement_applied}</td>
                  <td className="px-4 py-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {violationResourceLabel(v.resource_type)}
                    </span>
                    {v.deep_link_path ? (
                      <Link
                        href={v.deep_link_path}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Open trace
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {violations.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              No violations recorded yet. Telemetry will populate as the enforcement engine evaluates
              live traffic.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
