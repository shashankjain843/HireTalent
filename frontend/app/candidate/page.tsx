"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "candidate_portal_token";

export default function CandidatePortalSignIn() {
  const router = useRouter();
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("reason") === "expired"
      ? "Your portal session expired. Please sign in again."
      : null;
  });

  const saveAndGo = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setError("Paste your portal token from the seed output.");
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
        router.push("/candidate/opportunities");
      } catch {
        setError("Could not save token in this browser.");
      }
    },
    [router],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("token");
    if (!q) return;
    localStorage.setItem(STORAGE_KEY, q);
    router.push("/candidate/opportunities");
  }, [router]);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("token");
    const reason = params.get("reason");
    if (reason === "expired") {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (existing && !fromUrl) {
      router.replace("/candidate/opportunities");
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Candidate portal</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with the portal token printed when you run{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
            python -m seed_candidates
          </code>{" "}
          in the backend folder.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setInfo(null);
          saveAndGo(token);
        }}
      >
        {info && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
            {info}
          </p>
        )}
        <div>
          <label
            htmlFor="portal-token"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Portal token
          </label>
          <input
            id="portal-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
