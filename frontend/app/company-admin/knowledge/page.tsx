"use client";

import { useEffect, useRef, useState } from "react";
import {
  createKnowledgeSource,
  deleteKnowledgeSource,
  getKnowledgeSyncSummary,
  listKnowledgeGaps,
  listKnowledgeSources,
  retryKnowledgeSource,
  runKnowledgeQaSandbox,
  markKnowledgeGap,
} from "../../../lib/adminApi";
import type {
  KnowledgeGapResponse,
  KnowledgeSourceResponse,
  KnowledgeSyncSummaryResponse,
  QaSandboxResponse,
} from "../../../lib/adminTypes";

export default function KnowledgePage() {
  const sourceRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [governanceFocus, setGovernanceFocus] = useState<{
    sourceId?: string;
    chunkId?: string;
  }>({});
  const [sources, setSources] = useState<KnowledgeSourceResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activePanel, setActivePanel] = useState<"overview" | "qa">("overview");
  const [summary, setSummary] = useState<KnowledgeSyncSummaryResponse | null>(null);
  const [gaps, setGaps] = useState<KnowledgeGapResponse[]>([]);
  const [form, setForm] = useState({
    title: "",
    source_type: "text" as string,
    connector_kind: "",
    sync_frequency: "manual",
    source_url: "",
    raw_content: "",
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const sourceId = u.searchParams.get("sourceId") ?? undefined;
    const chunkId = u.searchParams.get("chunkId") ?? undefined;
    if (sourceId || chunkId) setGovernanceFocus({ sourceId, chunkId });
  }, []);

  useEffect(() => {
    if (!governanceFocus.sourceId || sources.length === 0) return;
    const row = sourceRowRefs.current[governanceFocus.sourceId];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sources, governanceFocus.sourceId]);

  async function refreshData() {
    setRefreshing(true);
    try {
      const [sourcesResp, summaryResp, gapsResp] = await Promise.all([
        listKnowledgeSources(),
        getKnowledgeSyncSummary(),
        listKnowledgeGaps(),
      ]);
      setSources(sourcesResp);
      setSummary(summaryResp);
      setGaps(gapsResp);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createKnowledgeSource({
        title: form.title,
        source_type: form.source_type,
        connector_kind: form.connector_kind || undefined,
        sync_frequency: form.sync_frequency,
        source_url: form.source_url || undefined,
        raw_content: form.raw_content || undefined,
      });
      await refreshData();
      setShowForm(false);
      setForm({
        title: "",
        source_type: "text",
        connector_kind: "",
        sync_frequency: "manual",
        source_url: "",
        raw_content: "",
      });
    } catch {}
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await deleteKnowledgeSource(id);
    await refreshData();
  }

  async function handleRetry(id: string) {
    await retryKnowledgeSource(id);
    await refreshData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Knowledge Operations Hub</h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor ingestion, indexing health, and source quality in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refreshData()}
            disabled={refreshing}
            className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "qa" ? "overview" : "qa")}
            className="bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            {activePanel === "qa" ? "Close QA Sandbox" : "Open QA Sandbox"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
          >
            {showForm ? "Cancel" : "Add Source"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Sources" value={summary?.total_sources ?? sources.length} />
        <MetricCard label="Indexed" value={summary?.indexed_sources ?? 0} tone="success" />
        <MetricCard label="Syncing" value={summary?.syncing_sources ?? 0} tone="info" />
        <MetricCard label="Failed" value={summary?.failed_sources ?? 0} tone="danger" />
        <MetricCard
          label="Embedding Coverage"
          value={`${(summary?.embedding_coverage_pct ?? 0).toFixed(1)}%`}
          tone="default"
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-4"
        >
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
            <p className="font-medium">How to add a source</p>
            <p>
              <strong>Type:</strong> choose Text for pasted content, URL for web pages, File for uploads.
            </p>
            <p>
              <strong>Connector:</strong> select only when syncing from external systems.
            </p>
            <p>
              <strong>Content/URL:</strong> provide one clear source; indexing status will appear in the table.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="text-sm text-gray-600">Title</span>
              <p className="mt-1 text-xs text-gray-500">A short internal name for this knowledge source.</p>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Company Overview"
              />
            </label>
            <label>
              <span className="text-sm text-gray-600">Type</span>
              <p className="mt-1 text-xs text-gray-500">Controls which input fields are required below.</p>
              <select
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="file">File</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="text-sm text-gray-600">Connector</span>
              <p className="mt-1 text-xs text-gray-500">Optional. Leave as manual if pasting content directly.</p>
              <select
                value={form.connector_kind}
                onChange={(e) => setForm({ ...form, connector_kind: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Manual / none</option>
                <option value="google_drive">Google Drive</option>
                <option value="notion">Notion</option>
                <option value="web_crawl">Web Crawler</option>
              </select>
            </label>
            <label>
              <span className="text-sm text-gray-600">Sync Frequency</span>
              <select
                value={form.sync_frequency}
                onChange={(e) => setForm({ ...form, sync_frequency: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manual">Manual</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
          </div>
          {form.source_type === "url" && (
            <label>
              <span className="text-sm text-gray-600">URL</span>
              <input
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                type="url"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com/about"
              />
            </label>
          )}
          {form.source_type === "text" && (
            <label>
              <span className="text-sm text-gray-600">Content</span>
              <textarea
                value={form.raw_content}
                onChange={(e) => setForm({ ...form, raw_content: e.target.value })}
                rows={6}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste your knowledge content here..."
              />
            </label>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
            >
              Add Source
            </button>
          </div>
        </form>
      )}

      {sources.length === 0 ? (
        <EmptyKnowledgeState
          onQuickStart={(type) => {
            setShowForm(true);
            setForm((prev) => ({
              ...prev,
              source_type: type,
              connector_kind: type === "url" ? "web_crawl" : "",
            }));
          }}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-4">
          {(governanceFocus.sourceId || governanceFocus.chunkId) && (
            <div className="xl:col-span-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
              <p className="font-medium">Governance trace</p>
              <p className="mt-1 text-indigo-900/90">
                {governanceFocus.sourceId && (
                  <>
                    Source{" "}
                    <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                      {governanceFocus.sourceId}
                    </code>
                  </>
                )}
                {governanceFocus.chunkId && (
                  <>
                    {governanceFocus.sourceId ? " · " : null}
                    Chunk{" "}
                    <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                      {governanceFocus.chunkId}
                    </code>
                  </>
                )}
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Embedding Progress</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Chunks</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((s) => {
                  const progress = inferEmbeddingProgress(s.status, s.chunk_count);
                  const isGovHighlight = governanceFocus.sourceId === s.id;
                  return (
                    <tr
                      key={s.id}
                      ref={(el) => {
                        sourceRowRefs.current[s.id] = el;
                      }}
                      className={`hover:bg-gray-50 ${isGovHighlight ? "bg-indigo-50/80 ring-2 ring-inset ring-indigo-400" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getSourceTypeIcon(s.source_type)}</span>
                          <div>
                            <p className="font-medium text-gray-900">{s.title}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                              {s.connector_kind
                                ? `${s.source_type} · ${s.connector_kind}`
                                : s.source_type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 min-w-44">
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full ${progress.color}`}
                            style={{ width: `${progress.value}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{progress.label}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{s.chunk_count}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.updated_at).toLocaleDateString()}
                        {s.last_error && (
                          <p className="mt-1 text-[11px] text-red-600">Error: {s.last_error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {s.status === "failed" && (
                            <button
                              onClick={() => void handleRetry(s.id)}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => void handleDelete(s.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            {activePanel === "qa" ? (
              <QaSandboxPanel onGapMarked={() => void refreshData()} />
            ) : (
              <RightRailOverview gaps={gaps} avgChunksPerSource={summary?.avg_chunks_per_source ?? 0} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "info" | "danger";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-gray-900 bg-white border-gray-200",
    success: "text-green-700 bg-green-50 border-green-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
    danger: "text-red-700 bg-red-50 border-red-200",
  };
  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    syncing: { label: "Syncing", className: "bg-blue-100 text-blue-700" },
    processing: { label: "Syncing", className: "bg-blue-100 text-blue-700" },
    pending: { label: "Syncing", className: "bg-blue-100 text-blue-700" },
    indexed: { label: "Indexed", className: "bg-green-100 text-green-700" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700" },
  };
  const normalized = map[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${normalized.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {normalized.label}
    </span>
  );
}

function EmptyKnowledgeState({
  onQuickStart,
}: {
  onQuickStart: (type: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.12em] text-indigo-600 uppercase">
          Empty State
        </p>
        <h3 className="text-2xl font-semibold text-gray-900 mt-2">
          Build your company knowledge graph in minutes
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          Connect your content sources and we will handle chunking, embeddings, and indexing.
          Start with one source and expand as your assistant usage grows.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <QuickStartCard
          icon="🗂"
          title="Connect Google Drive"
          subtitle="Sync docs every 6 hours"
          onClick={() => onQuickStart("url")}
        />
        <QuickStartCard
          icon="🧩"
          title="Connect Notion"
          subtitle="Import pages and databases"
          onClick={() => onQuickStart("url")}
        />
        <QuickStartCard
          icon="🌍"
          title="Crawl Public Docs"
          subtitle="Ingest docs site URLs automatically"
          onClick={() => onQuickStart("url")}
        />
        <QuickStartCard
          icon="📄"
          title="Paste Internal SOP"
          subtitle="Quickly seed your first indexed content"
          onClick={() => onQuickStart("text")}
        />
      </div>
    </div>
  );
}

function QuickStartCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
    >
      <p className="text-lg">{icon}</p>
      <p className="font-medium text-gray-900 mt-2">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </button>
  );
}

function RightRailOverview({
  gaps,
  avgChunksPerSource,
}: {
  gaps: KnowledgeGapResponse[];
  avgChunksPerSource: number;
}) {
  const tasks = [
    "Set connector credentials for Google Drive and Notion.",
    "Configure domain allowlist for public crawler.",
    "Enable QA sandbox for editor role.",
    "Review failed sync alerts weekly.",
  ];
  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Operational Checklist</h3>
        <p className="text-xs text-gray-500 mt-1">
          Keep indexing healthy and transparent for your teams.
        </p>
      </div>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task} className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
            {task}
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3">
        <p className="text-xs uppercase tracking-wide text-indigo-700">Chunking Density</p>
        <p className="text-lg font-semibold text-indigo-900 mt-1">
          {avgChunksPerSource.toFixed(1)} chunks/source
        </p>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Top Knowledge Gaps</h4>
        <div className="space-y-2 mt-2">
          {gaps.length === 0 && (
            <p className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-md p-3">
              No failed query patterns detected yet.
            </p>
          )}
          {gaps.map((gap) => (
            <div key={gap.label} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{gap.label}</p>
                <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                  {gap.failed_runs} failed
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {gap.query_count} queries · Avg confidence {(gap.avg_confidence * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function QaSandboxPanel({ onGapMarked }: { onGapMarked: () => void }) {
  const [availableSources, setAvailableSources] = useState<KnowledgeSourceResponse[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QaSandboxResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingGap, setMarkingGap] = useState(false);
  const [markMessage, setMarkMessage] = useState<string | null>(null);

  useEffect(() => {
    listKnowledgeSources()
      .then((resp) => setAvailableSources(resp.filter((s) => s.status === "indexed")))
      .catch(() => setAvailableSources([]));
  }, []);

  async function handleRun() {
    if (!prompt.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const resp = await runKnowledgeQaSandbox({
        prompt,
        top_k: 5,
        source_ids: selectedSourceIds,
      });
      setResult(resp);
      setMarkMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run QA sandbox");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  async function handleMarkGap() {
    if (!prompt.trim()) return;
    setMarkingGap(true);
    setMarkMessage(null);
    try {
      await markKnowledgeGap({
        prompt,
        skill_run_id: result?.skill_run_id ?? null,
        source_ids: selectedSourceIds,
      });
      setMarkMessage("Marked as knowledge gap.");
      onGapMarked();
    } catch {
      setMarkMessage("Could not mark knowledge gap. Try again.");
    } finally {
      setMarkingGap(false);
    }
  }

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">QA Sandbox</h3>
        <p className="text-xs text-gray-500 mt-1">
          Test admin prompts with current indexed content and inspect retrieval citations.
        </p>
      </div>
      <div>
        <label className="text-xs text-gray-600">Prompt</label>
        <textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What are our interview scorecard standards for backend engineers?"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-gray-600">Source Scope</label>
        <select
          multiple
          value={selectedSourceIds}
          onChange={(event) => {
            const values = Array.from(event.target.selectedOptions).map((option) => option.value);
            setSelectedSourceIds(values);
          }}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-24"
        >
          {availableSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 mt-1">
          Leave unselected to search all indexed sources.
        </p>
      </div>
      <button
        onClick={() => void handleRun()}
        disabled={running || !prompt.trim()}
        className="w-full bg-indigo-600 text-white text-sm py-2 rounded-md hover:bg-indigo-500 disabled:opacity-60"
      >
        {running ? "Running..." : "Run Retrieval Test"}
      </button>
      <button
        onClick={() => void handleMarkGap()}
        disabled={markingGap || !prompt.trim()}
        className="w-full bg-amber-100 text-amber-800 text-sm py-2 rounded-md hover:bg-amber-200 disabled:opacity-60"
      >
        {markingGap ? "Marking..." : "Mark as Knowledge Gap"}
      </button>
      {markMessage && <p className="text-xs text-gray-600">{markMessage}</p>}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {result ? (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs uppercase tracking-wide text-gray-500">Answer</p>
            <p className="text-sm text-gray-800 mt-1">{result.answer}</p>
            <p className="text-xs text-gray-500 mt-2">
              Confidence: {(result.confidence * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Citations</p>
            <div className="space-y-2">
              {result.citations.length === 0 && (
                <p className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-md p-3">
                  No chunks retrieved for this prompt.
                </p>
              )}
              {result.citations.map((citation, idx) => (
                <div key={`${citation.chunk_id}-${idx}`} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Chunk {idx + 1}</span>
                    <span>Score {(citation.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{citation.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 p-3">
          <p className="text-xs text-gray-500">
            Run a prompt to view retrieval trace and citation snippets.
          </p>
        </div>
      )}
    </>
  );
}

function getSourceTypeIcon(sourceType: string) {
  const icons: Record<string, string> = {
    google_drive: "🗂",
    notion: "🧩",
    url: "🌍",
    file: "📎",
    text: "📄",
  };
  return icons[sourceType] ?? "📚";
}

function inferEmbeddingProgress(status: string, chunkCount: number) {
  if (status === "indexed") {
    return { value: 100, label: "Completed", color: "bg-green-500" };
  }
  if (status === "failed") {
    return { value: 100, label: "Failed during sync", color: "bg-red-500" };
  }
  if (["pending", "processing", "syncing"].includes(status)) {
    const value = Math.min(90, Math.max(20, Math.round(chunkCount * 10)));
    return { value, label: "Embedding in progress", color: "bg-blue-500" };
  }
  return { value: 15, label: "Queued", color: "bg-gray-400" };
}
