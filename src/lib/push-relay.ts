export function getPushRelayUrl(): string {
  return process.env.NEXT_PUBLIC_PUSH_RELAY_URL?.trim() ?? "";
}

export function getPushApiSecret(): string {
  return process.env.NEXT_PUBLIC_PUSH_API_SECRET?.trim() ?? "";
}

export function isPushRelayConfigured(): boolean {
  return getPushRelayUrl().length > 0 && getPushApiSecret().length > 0;
}

const RELAY_PUSH_TYPES = new Set(["schedule_created", "application_submitted"]);

export type PushRelayInput = {
  targetUserId: string;
  title: string;
  message: string;
  type: "schedule_created" | "application_submitted";
};

/** Blaze 없이 Cloudflare Worker 경유 FCM 백그라운드 푸시 */
export async function dispatchPushRelay(input: PushRelayInput): Promise<void> {
  if (!RELAY_PUSH_TYPES.has(input.type)) return;

  const relayUrl = getPushRelayUrl();
  const secret = getPushApiSecret();
  if (!relayUrl || !secret) return;

  const res = await fetch(relayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `push relay failed (${res.status})`);
  }
}
