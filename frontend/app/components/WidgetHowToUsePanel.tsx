"use client";

import { createWidgetSession } from "@/lib/api";
import type { WidgetAdminConfigResponse } from "@/lib/adminTypes";
import { getWidgetSessionTestError } from "@/lib/widgetSessionErrors";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  subtitle: string;
  loadConfig: () => Promise<WidgetAdminConfigResponse>;
};

export default function WidgetHowToUsePanel({ title, subtitle, loadConfig }: Props) {
  const searchParams = useSearchParams();
  const [botId, setBotId] = useState("");
  const [embedToken, setEmbedToken] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [position, setPosition] = useState("bottom-right");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [installDomain, setInstallDomain] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const config = await loadConfig();
        if (cancelled) return;
        setBotId(config.bot_id);
        setPrimaryColor(config.primary_color || "#2563eb");
        setPosition(config.launcher_position || "bottom-right");
        setAllowedDomains(config.allowed_domains || []);
      } catch {
        if (!cancelled) {
          setError("Could not auto-load bot config. You can still paste values manually.");
        }
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
      setTenantSlug(slugFromQuery.trim());
    }
  }, [searchParams]);

  const snippet = useMemo(() => {
    const tokenValue = embedToken.trim() || "REPLACE_WITH_EMBED_TOKEN";
    const botValue = botId.trim() || "REPLACE_WITH_BOT_ID";
    const allowedDomainsValue = allowedDomains.join(",");
    const appOrigin =
      typeof window === "undefined" ? "REPLACE_WITH_APP_ORIGIN" : window.location.origin;
    return `<script
  src="${appOrigin}/widget.v1.js"
  data-bot-id="${botValue}"
  data-embed-token="${tokenValue}"
  data-tenant-slug="${tenantSlug.trim() || "REPLACE_WITH_TENANT_SLUG"}"
  data-api-base="${appOrigin}"
  data-widget-path="/widget"
  data-primary-color="${primaryColor}"
  data-position="${position}"
  data-allowed-domains="${allowedDomainsValue}"
></script>`;
  }, [allowedDomains, botId, embedToken, position, primaryColor, tenantSlug]);

  const normalizedInstallDomain = installDomain.trim().toLowerCase();
  const domainIsAllowed =
    !normalizedInstallDomain || allowedDomains.includes(normalizedInstallDomain);

  async function handleCopySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setStatus("Snippet copied.");
      setError(null);
    } catch {
      setError("Copy failed. Please select and copy the snippet manually.");
      setStatus(null);
    }
  }

  async function handleTestConfiguration() {
    if (!botId.trim() || !embedToken.trim()) {
      setError("Bot ID and embed token are required for test.");
      setStatus(null);
      return;
    }
    setTesting(true);
    setStatus(null);
    setError(null);
    try {
      await createWidgetSession(botId.trim(), embedToken.trim());
      setStatus("Configuration test passed.");
    } catch (err) {
      setError(getWidgetSessionTestError(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p className="text-sm text-zinc-600">{subtitle}</p>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {status && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{status}</p>}

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Step 1: Fill required values</h2>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Bot ID</span>
          <input
            value={botId}
            onChange={(event) => setBotId(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Paste bot_id"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Embed token</span>
          <input
            value={embedToken}
            onChange={(event) => setEmbedToken(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Paste embed_token"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Tenant slug</span>
          <input
            value={tenantSlug}
            onChange={(event) => setTenantSlug(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="e.g. acme"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Step 2: Domain allowlist check</h2>
        <input
          value={installDomain}
          onChange={(event) => setInstallDomain(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="example.com"
        />
        {normalizedInstallDomain && !domainIsAllowed && (
          <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
            Domain is not allowlisted. Add <code>{normalizedInstallDomain}</code> in Widget Admin.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold">Step 3: Copy this snippet</h2>
        <pre className="whitespace-pre-wrap break-all rounded bg-zinc-950 p-3 text-xs text-zinc-100">{snippet}</pre>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleCopySnippet()}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            Copy snippet
          </button>
          <button
            onClick={() => void handleTestConfiguration()}
            disabled={testing}
            className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {testing ? "Testing..." : "Test configuration"}
          </button>
        </div>
      </section>
    </main>
  );
}
