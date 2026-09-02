import type { ActionResponse, CategoryResponse } from "./adminTypes";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getStarterActions(
  tenantSlug: string,
): Promise<ActionResponse[]> {
  return publicRequest<ActionResponse[]>(
    `/public/t/${tenantSlug}/starter-actions`,
  );
}

export async function getCategories(
  tenantSlug: string,
): Promise<CategoryResponse[]> {
  return publicRequest<CategoryResponse[]>(
    `/public/t/${tenantSlug}/categories`,
  );
}

export async function getActionsByCategory(
  tenantSlug: string,
  categoryId?: string,
): Promise<ActionResponse[]> {
  const q = categoryId ? `?category_id=${categoryId}` : "";
  return publicRequest<ActionResponse[]>(
    `/public/t/${tenantSlug}/actions${q}`,
  );
}

export async function trackActionClick(
  tenantSlug: string,
  actionId: string,
): Promise<void> {
  await publicRequest<{ ok: boolean }>(
    `/public/t/${tenantSlug}/actions/${actionId}/click`,
    { method: "POST" },
  );
}

export interface RouteResult {
  decision: string;
  confidence: number;
  output: Record<string, unknown>;
}

export async function routeMessage(
  tenantSlug: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<RouteResult> {
  return publicRequest<RouteResult>(`/public/t/${tenantSlug}/route`, {
    method: "POST",
    body: JSON.stringify({ message, metadata }),
  });
}

export async function submitFeedback(
  tenantSlug: string,
  eventType: string,
  metadata?: Record<string, unknown>,
  skillRunId?: string,
): Promise<void> {
  await publicRequest<{ ok: boolean }>(`/public/t/${tenantSlug}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      event_type: eventType,
      metadata,
      skill_run_id: skillRunId,
    }),
  });
}
