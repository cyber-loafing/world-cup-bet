import type { UserSchema } from "@insforge/sdk";
import { insforge } from "@/lib/insforge";

const storageKey = "world-cup-bet:insforge-session:v1";
const expiryLeewayMs = 30_000;

type RememberedSession = {
  accessToken: string;
  expiresAt: number | null;
  savedAt: number;
  user: UserSchema;
};

type CurrentSessionResponse = {
  user?: UserSchema | null;
};

export function rememberSession(accessToken: string | null | undefined, user: UserSchema | null | undefined) {
  if (typeof window === "undefined" || !accessToken || !isUser(user)) {
    return;
  }

  const session: RememberedSession = {
    accessToken,
    expiresAt: getJwtExpiresAt(accessToken),
    savedAt: Date.now(),
    user,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearRememberedSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export async function restoreRememberedSession(): Promise<UserSchema | null> {
  if (typeof window === "undefined" || !insforge) {
    return null;
  }

  const session = readRememberedSession();
  if (!session) {
    return null;
  }

  if (session.expiresAt && Date.now() > session.expiresAt - expiryLeewayMs) {
    clearStoredToken();
    return null;
  }

  insforge.setAccessToken(session.accessToken);

  try {
    const response = await insforge.getHttpClient().get<CurrentSessionResponse>("/api/auth/sessions/current");
    const user = response.user ?? null;

    if (!isUser(user)) {
      clearStoredToken();
      return null;
    }

    rememberSession(session.accessToken, user);
    return user;
  } catch {
    clearStoredToken();
    return null;
  }
}

function readRememberedSession(): RememberedSession | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RememberedSession>;
    if (typeof parsed.accessToken !== "string" || !isUser(parsed.user)) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      user: parsed.user,
    };
  } catch {
    clearRememberedSession();
    return null;
  }
}

function clearStoredToken() {
  clearRememberedSession();
  insforge?.setAccessToken(null);
}

function getJwtExpiresAt(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(window.atob(normalized)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isUser(value: unknown): value is UserSchema {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
}
