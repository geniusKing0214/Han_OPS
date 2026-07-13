import { importPKCS8, SignJWT } from "jose";

type Env = {
  FIREBASE_SERVICE_ACCOUNT: string;
  PUSH_API_SECRET: string;
  APP_ORIGIN: string;
  APP_BASE_PATH: string;
  FIREBASE_PROJECT_ID: string;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type PushBody = {
  targetUserId?: string;
  title?: string;
  message?: string;
  type?: string;
  notificationId?: string;
};

const PUSH_TYPES = new Set([
  "schedule_created",
  "schedule_cancelled",
  "application_submitted",
  "application_approved",
  "notice_posted",
]);

const corsOrigin = "https://geniusking0214.github.io";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function resolveOpenUrl(env: Env, type: string | undefined): string {
  const origin = env.APP_ORIGIN.replace(/\/$/, "");
  const base = env.APP_BASE_PATH.replace(/\/$/, "");
  if (type === "schedule_created" || type === "schedule_cancelled") {
    return `${origin}${base}/schedule/`;
  }
  if (type === "application_submitted") {
    return `${origin}${base}/admin/applications/`;
  }
  if (type === "application_approved") {
    return `${origin}${base}/applications/`;
  }
  if (type === "notice_posted") {
    return `${origin}${base}/notices/`;
  }
  return `${origin}${base}/dashboard/`;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const pk = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pk);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`oauth token failed (${res.status})`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("missing access_token");
  return data.access_token;
}

function parseStringArrayField(
  doc: Record<string, unknown> | undefined,
  field: string,
): string[] {
  const fields = doc?.fields as Record<string, unknown> | undefined;
  const raw = fields?.[field] as { arrayValue?: { values?: unknown[] } } | undefined;
  const values = raw?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => {
      const item = v as { stringValue?: string };
      return typeof item.stringValue === "string" ? item.stringValue : "";
    })
    .filter(Boolean);
}

async function fetchFcmTokens(
  env: Env,
  accessToken: string,
  uid: string,
): Promise<string[]> {
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`firestore read failed (${res.status})`);
  }
  const doc = (await res.json()) as Record<string, unknown>;
  return [...new Set(parseStringArrayField(doc, "fcmTokens"))];
}

async function sendFcm(
  env: Env,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  url: string,
  type: string,
  notificationId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = env.FIREBASE_PROJECT_ID;

  // iOS PWA 백그라운드: notification 필드 없이 data-only 가 Service Worker 수신에 유리
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          data: {
            type,
            url,
            title,
            body,
            ...(notificationId ? { notificationId } : {}),
          },
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "86400",
            },
            fcm_options: { link: url },
          },
        },
      }),
    },
  );

  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  return { ok: false, error: text || `fcm ${res.status}` };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }

    const auth = request.headers.get("Authorization") ?? "";
    const expected = `Bearer ${env.PUSH_API_SECRET}`;
    if (!env.PUSH_API_SECRET || auth !== expected) {
      return json({ error: "unauthorized" }, 401);
    }

    let body: PushBody;
    try {
      body = (await request.json()) as PushBody;
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const targetUserId = body.targetUserId?.trim();
    const type = body.type?.trim();
    const title = body.title?.trim() || "HAN OPS";
    const message = body.message?.trim() || "";
    const notificationId = body.notificationId?.trim();

    if (!targetUserId || !type || !PUSH_TYPES.has(type)) {
      return json({ error: "invalid payload" }, 400);
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    } catch {
      return json({ error: "service account misconfigured" }, 500);
    }

    try {
      const accessToken = await getAccessToken(sa);
      const tokens = await fetchFcmTokens(env, accessToken, targetUserId);
      if (tokens.length === 0) {
        return json({ ok: true, sent: 0, reason: "no_tokens" });
      }

      const url = resolveOpenUrl(env, type);
      let sent = 0;
      const errors: string[] = [];
      for (const token of tokens) {
        const result = await sendFcm(
          env,
          accessToken,
          token,
          title,
          message,
          url,
          type,
          notificationId,
        );
        if (result.ok) {
          sent += 1;
        } else if (result.error) {
          errors.push(result.error.slice(0, 200));
        }
      }

      return json({
        ok: true,
        sent,
        total: tokens.length,
        ...(errors.length > 0 ? { errors: errors.slice(0, 3) } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "push failed";
      return json({ error: msg }, 500);
    }
  },
};
