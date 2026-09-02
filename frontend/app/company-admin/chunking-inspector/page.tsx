"use client";

import { useEffect, useMemo, useState } from "react";
import { listKnowledgeChunks, listKnowledgeSources } from "../../../lib/adminApi";
import type {
  KnowledgeChunkResponse,
  KnowledgeSourceResponse,
} from "../../../lib/adminTypes";

export default function ChunkingInspectorPage() {
  const [sources, setSources] = useState<KnowledgeSourceResponse[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [chunks, setChunks] = useState<KnowledgeChunkResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listKnowledgeSources()
      .then((resp) => {
        setSources(resp);
        if (resp.length > 0) {
          setLoading(true);
          setSelectedSourceId(resp[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSourceId) return;
    listKnowledgeChunks(selectedSourceId)
      .then(setChunks)
      .catch(() => setChunks([]))
      .finally(() => setLoading(false));
  }, [selectedSourceId]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [sources, selectedSourceId],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Chunking Inspector</h2>
          <p className="text-sm text-gray-500 mt-1">
            Validate how sources are split into retrieval chunks before production QA.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="text-sm text-gray-600">Knowledge Source</label>
        <select
          value={selectedSourceId}
          onChange={(event) => {
            setLoading(true);
            setSelectedSourceId(event.target.value);
          }}
          className="mt-1 block w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {sources.length === 0 && <option value="">No sources available</option>}
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title} ({source.chunk_count} chunks)
            </option>
          ))}
        </select>
        {selectedSource && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2 py-1">
              Type: {selectedSource.source_type}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1">
              Status: {selectedSource.status}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1">
              Frequency: {selectedSource.sync_frequency}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Chunk Count</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{chunks.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Average Length</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {chunks.length === 0
              ? "0"
              : Math.round(
                  chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length,
                )}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Retrieval Readiness</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {chunks.length > 0 ? "Ready" : "Pending"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
            Loading chunks...
          </div>
        )}
        {!loading && chunks.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
            No chunks found for this source yet. Trigger a sync from Knowledge Base.
          </div>
        )}
        {chunks.map((chunk) => (
          <article key={chunk.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span className="font-medium text-gray-700">Chunk #{chunk.chunk_index + 1}</span>
              <span>{chunk.content.length} chars</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 mb-3 overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${Math.min(100, Math.round((chunk.content.length / 500) * 100))}%` }}
              />
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{chunk.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
