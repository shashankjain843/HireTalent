type ApiErrorInfo = {
  status: number | null;
  detail: string;
};

function parseApiError(error: unknown): ApiErrorInfo {
  if (!(error instanceof Error) || !error.message) {
    return { status: null, detail: "" };
  }
  const match = error.message.match(/^API error (\d+):\s*([\s\S]*)$/);
  if (!match) {
    return { status: null, detail: error.message };
  }

  const status = Number.parseInt(match[1] ?? "", 10);
  const rawBody = (match[2] ?? "").trim();
  if (!rawBody) {
    return { status: Number.isFinite(status) ? status : null, detail: "" };
  }

  try {
    const parsed = JSON.parse(rawBody) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return {
        status: Number.isFinite(status) ? status : null,
        detail: parsed.detail,
      };
    }
  } catch {
    // Body is plain text.
  }

  return {
    status: Number.isFinite(status) ? status : null,
    detail: rawBody,
  };
}

export function getWidgetSessionStartupError(error: unknown): string {
  const { status, detail } = parseApiError(error);
  const normalized = detail.toLowerCase();

  if (normalized.includes("invalid embed token")) {
    return "Unable to start widget session: embed token is invalid. Rotate/copy a fresh token from Widget Admin and retry.";
  }
  if (normalized.includes("bot not found")) {
    return "Unable to start widget session: bot_id is invalid or inactive. Verify the bot ID in your install snippet.";
  }
  if (normalized.includes("origin is not allowed")) {
    return "Unable to start widget session: this domain is not allowlisted. Add your current host in Widget Admin > Allowed domains.";
  }
  if (normalized.includes("missing or invalid origin")) {
    return "Unable to start widget session: request origin is missing. Load the widget from a real http(s) page and check data-api-base.";
  }
  if (status === 404) {
    return "Unable to start widget session: bot not found. Verify bot_id.";
  }
  if (status === 401) {
    return "Unable to start widget session: invalid embed token. Use an active token for this bot.";
  }
  if (status === 403) {
    return "Unable to start widget session: domain not allowlisted for this bot.";
  }
  if (status === 400) {
    return "Unable to start widget session: invalid widget request. Verify data-api-base and data-bot-id.";
  }
  if (status === 0 || status === null) {
    return "Unable to start widget session: network/API base issue. Verify data-api-base points to your live frontend/backend.";
  }
  return "Unable to start widget session. Check bot ID, embed token, API base, and allowed domains.";
}

export function getWidgetSessionTestError(error: unknown): string {
  const { status, detail } = parseApiError(error);
  const normalized = detail.toLowerCase();

  if (normalized.includes("invalid embed token") || status === 401) {
    return "Configuration test failed: invalid embed token. Rotate/copy a fresh active token and retry.";
  }
  if (normalized.includes("bot not found") || status === 404) {
    return "Configuration test failed: bot_id is invalid or inactive.";
  }
  if (normalized.includes("origin is not allowed") || status === 403) {
    return "Configuration test failed: current domain is not allowlisted for this bot.";
  }
  if (normalized.includes("missing or invalid origin") || status === 400) {
    return "Configuration test failed: missing/invalid Origin or API base. Run from an http(s) page and verify API URL.";
  }
  return "Configuration test failed. Check bot ID, embed token, API base, and allowed domains.";
}
