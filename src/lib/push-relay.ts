export function getPushRelayUrl(): string {
  return process.env.NEXT_PUBLIC_PUSH_RELAY_URL?.trim() ?? "";
}

export function getPushApiSecret(): string {
  return process.env.NEXT_PUBLIC_PUSH_API_SECRET?.trim() ?? "";
}

export function isPushRelayConfigured(): boolean {
  return getPushRelayUrl().length > 0 && getPushApiSecret().length > 0;
}

const RELAY_PUSH_TYPES = new Set([
  "schedule_created",
  "application_submitted",
  "application_approved",
  "notice_posted",
]);

export type PushRelayInput = {
  targetUserId: string;
  title: string;
  message: string;
  notificationId?: string;
  type:
    | "schedule_created"
    | "application_submitted"
    | "application_approved"
    | "notice_posted";
};

export type PushRelayResult = {
  ok: boolean;
  sent?: number;
  total?: number;
  reason?: string;
  errors?: string[];
  error?: string;
};

/** Blaze 없이 Cloudflare Worker 경유 FCM 백그라운드 푸시 */
export async function dispatchPushRelay(
  input: PushRelayInput,
): Promise<PushRelayResult> {
  if (!RELAY_PUSH_TYPES.has(input.type)) {
    return { ok: false, error: "unsupported type" };
  }

  const relayUrl = getPushRelayUrl();
  const secret = getPushApiSecret();
  if (!relayUrl || !secret) {
    return { ok: false, error: "push relay not configured" };
  }

  const res = await fetch(relayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as PushRelayResult;
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || (await res.text().catch(() => "")) || `push relay failed (${res.status})`,
    };
  }
  return data;
}

/** 설정 화면: 이 기기로 테스트 푸시 발송 */
export async function sendTestPushToSelf(userId: string): Promise<PushRelayResult> {
  return dispatchPushRelay({
    targetUserId: userId,
    title: "HAN OPS 테스트",
    message: "백그라운드 푸시가 정상 동작합니다.",
    type: "notice_posted",
    notificationId: `test-${Date.now()}`,
  });
}
