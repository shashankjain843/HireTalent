"use client";

import {
  createWidgetSession,
} from "@/lib/api";
import type {
  WidgetAdminConfigResponse,
  WidgetAdminConfigUpdateRequest,
  WidgetRotateTokenResponse,
} from "@/lib/adminTypes";
import { getWidgetSessionTestError } from "@/lib/widgetSessionErrors";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  roleLabel: "superadmin" | "tenant-admin";
  loadConfig: () => Promise<WidgetAdminConfigResponse>;
  saveConfig: (payload: WidgetAdminConfigUpdateRequest) => Promise<WidgetAdminConfigResponse>;
  rotateToken: () => Promise<WidgetRotateTokenResponse>;
  canEdit: boolean;
  editLockedMessage?: string;
  howToUseHref: string;
};

export default function WidgetAdminSettingsPanel({
  roleLabel,
  loadConfig,
  saveConfig,
  rotateToken,
  canEdit,
  editLockedMessage,
  howToUseHref,
}: Props) {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<WidgetAdminConfigResponse | null>(null);
  const [name, setName] = useState("");
  const [welcomeText, setWelcomeText] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [position, setPosition] = useState("bottom-right");
  const [domainsText, setDomainsText] = useState("localhost");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [embedTokenForTest, setEmbedTokenForTest] = useState("");
  const [tenantSlugForSnippet, setTenantSlugForSnippet] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await loadConfig();
        if (cancelled) return;
        setConfig(data);
        setName(data.name);
        setWelcomeText(data.welcome_text);
        setPrimaryColor(data.primary_color || "#4f46e5");
        setPosition(data.launcher_position || "bottom-right");
        setDomainsText((data.allowed_domains || []).join(", "));
      } catch {
        if (!cancelled) setError("Failed to load widget admin config.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  useEffect(() => {
    const slugFromQuery = searchParams.get("tenant_slug") ?? searchParams.get("tenant") ?? "";
    if (slugFromQuery.trim()) {
      setTenantSlugForSnippet(slugFromQuery.trim());
    }
  }, [searchParams]);

  const snippet = useMemo(() => {
    if (!config) return "";
    const token = latestToken ?? `REPLACE_WITH_ACTIVE_TOKEN_${config.active_token_last4 ?? "XXXX"}`;
    const allowedDomains = domainsText
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean)
      .join(",");
    const slugValue = tenantSlugForSnippet.trim() || "REPLACE_WITH_TENANT_SLUG";
    return `<script src="${window.location.origin}/widget.v1.js" data-bot-id="${config.bot_id}" data-embed-token="${token}" data-tenant-slug="${slugValue}" data-api-base="${window.location.origin}" data-widget-path="/widget" data-primary-color="${primaryColor}" data-position="${position}" data-allowed-domains="${allowedDomains}"></script>`;
  }, [config, domainsText, latestToken, position, primaryColor, tenantSlugForSnippet]);

  const handleSave = async () => {
    if (!canEdit) {
      setError(editLockedMessage || "You do not have permission to edit widget behavior.");
      setStatus(null);
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const next = await saveConfig({
        name,
        welcome_text: welcomeText,
        primary_color: primaryColor,
        launcher_position: position,
        allowed_domains: domainsText
          .split(",")
          .map((domain) => domain.trim())
          .filter(Boolean),
      });
      setConfig(next);
      setStatus("Saved.");
    } catch {
      setError("Failed to save widget config.");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!canEdit) {
      setError(editLockedMessage || "You do not have permission to edit widget behavior.");
      setStatus(null);
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const rotated = await rotateToken();
      setLatestToken(rotated.embed_token);
      setEmbedTokenForTest(rotated.embed_token);
      setStatus(`Token rotated. New token ends with ${rotated.last4}.`);
      const refreshed = await loadConfig();
      setConfig(refreshed);
    } catch {
      setError("Token rotation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConfiguration = async () => {
    if (!config?.bot_id || !embedTokenForTest.trim()) {
      setError("Bot ID and an embed token are required for test.");
      setStatus(null);
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await createWidgetSession(config.bot_id, embedTokenForTest.trim());
      setStatus("Configuration test passed.");
    } catch (err) {
      setError(getWidgetSessionTestError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="p-6 text-sm text-zinc-500">Loading widget admin...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-xl font-semibold">Widget Behavior Admin</h1>
      <p className="text-sm text-zinc-600">
        Open the install guide in{" "}
        <Link href={howToUseHref} className="text-indigo-600 underline">
          How to use
        </Link>
        . Active role: <code>{roleLabel}</code>
      </p>
      {!canEdit && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
          {editLockedMessage || "Editing is locked for this role."}
        </p>
      )}
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {status && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{status}</p>}

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Branding and behavior</h2>
        <input
          disabled={!canEdit}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          placeholder="Widget name"
        />
        <textarea
          disabled={!canEdit}
          value={welcomeText}
          onChange={(event) => setWelcomeText(event.target.value)}
          className="h-24 w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          placeholder="Welcome message"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            disabled={!canEdit}
            value={primaryColor}
            onChange={(event) => setPrimaryColor(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            placeholder="#4f46e5"
          />
          <select
            disabled={!canEdit}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          >
            <option value="bottom-right">bottom-right</option>
            <option value="bottom-left">bottom-left</option>
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Allowed domains</h2>
        <input
          disabled={!canEdit}
          value={domainsText}
          onChange={(event) => setDomainsText(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
          placeholder="localhost, yourdomain.com"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Embed token</h2>
        <p className="text-sm text-zinc-600">
          Active token suffix: {config?.active_token_last4 ?? "unknown"}
        </p>
        <button
          onClick={() => void handleRotate()}
          disabled={saving || !canEdit}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Rotate token
        </button>
        {latestToken && <code className="block rounded bg-amber-50 p-2 text-xs">{latestToken}</code>}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Test config</h2>
        <input
          value={embedTokenForTest}
          onChange={(event) => setEmbedTokenForTest(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Paste embed token to test session creation"
        />
        <button
          onClick={() => void handleTestConfiguration()}
          disabled={saving}
          className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Test configuration
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Install snippet preview</h2>
        <input
          value={tenantSlugForSnippet}
          onChange={(event) => setTenantSlugForSnippet(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Tenant slug for snippet (e.g. acme)"
        />
        <pre className="whitespace-pre-wrap break-all rounded bg-zinc-950 p-3 text-xs text-zinc-100">{snippet}</pre>
      </section>

      <button
        onClick={() => void handleSave()}
        disabled={saving || !canEdit}
        className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        Save widget settings
      </button>
    </main>
  );
}
