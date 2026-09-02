const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
export const DIRECT_CHAT_PING_INTERVAL_MS = 20000;
export const DIRECT_CHAT_STALE_SOCKET_MS = 45000;

export function getDirectThreadWebSocketUrl(
  conversationId: string,
  candidateId: string,
): string {
  const apiUrl = new URL(API_BASE);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = `/api/realtime/ws/direct-thread/${conversationId}/${candidateId}`;
  apiUrl.search = "";
  apiUrl.hash = "";
  return apiUrl.toString();
}

export function getReconnectDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10000);
}
