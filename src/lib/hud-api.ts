// Client-side API for the HUD dashboard. The session token comes from the
// MOAP URL (?token=...) that the in-world HUD sets on its screen face.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface HudStats {
  energy: number;
  hydration: number;
  hunger: number;
  bladder: number;
  mood: number;
  immunity: number;
  sickness: number;
  rest: number;
  vitamins: number;
  comfort: number;
  nutrition: number;
  stress: number;
  baby_wellness: number;
  baby_bond: number;
  baby_movement: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string | null;
  kind: "note" | "milestone" | "memory" | "appointment";
  completed: boolean;
  entry_date: string;
  created_at: string;
  photo_url?: string | null;
}

export type LaborPhaseName =
  | "none"
  | "prelabor"
  | "early"
  | "active"
  | "transition"
  | "pushing"
  | "delivered";

export type EventSeverityName =
  | "info"
  | "milestone"
  | "request"
  | "important"
  | "labor"
  | "urgent"
  | "birth";

export interface HudState {
  error?: string;
  user: { name: string; avatarKey: string; role: "mom" | "partner" };
  pregnancy: {
    id: string;
    status: string;
    week: number;
    day: number;
    trimester: 1 | 2 | 3;
    progressPct: number;
    dueDate: string;
    daysToGo: number;
    delivered: boolean;
    babyName: string | null;
    babyGender: string;
    durationDays: number;
    setupComplete: boolean;
    setupStep: number;
    progressionMode: string;
    babyCount: number;
    babyNames: string[];
    privacyMode: string;
    labor?: {
      stage: string;
      phase: LaborPhaseName;
      inLabor: boolean;
      hospitalAdvised: boolean;
      minutesToBirth: number | null;
      intensity: number;
      waterBroken: boolean;
      atHospital: boolean;
      contractionMinutes: number;
      waterBrokenAt: string | null;
      contractionsStartedAt: string | null;
      hospitalAt: string | null;
      birthAt: string | null;
    };
    baby: {
      size: string;
      lengthCm: number;
      weightG: number;
      note: string;
      heartbeat: number;
      kicksToday: number;
      position: string;
      movement: string;
      wellness: number;
      bond: number;
      movementScore: number;
    };
  };
  stats: HudStats;
  mood?: {
    key: string;
    label: string;
    emoji: string;
    note: string;
    hint: string;
  };
  wellness: number;
  symptoms: { name: string; severity: number; label: string }[];
  journal: JournalEntry[];
  partner: {
    name: string | null;
    linked: boolean;
    code: string;
    support: number;
    activities: { actor_name: string; activity: string; created_at: string }[];
    pendingLinks: {
      id: string;
      partner_user_id: string;
      requested_at: string;
      avatar_name: string;
      display_name: string | null;
    }[];
    permissions: (Record<string, boolean> & { autoAccept: Record<string, boolean> }) | null;
  };
  requests: {
    incoming: {
      id: string;
      actionType: string;
      label: string;
      from: string;
      line: string;
      createdAt: string;
      expiresAt: string;
    }[];
    outgoing: { id: string; actionType: string; label: string; expiresAt: string }[];
  };
  hospitalBag: {
    items: {
      key: string;
      label: string;
      group: "Mom" | "Personal" | "Baby";
      checked: boolean;
      checkedBy: string | null;
      checkedAt: string | null;
    }[];
    packed: number;
    total: number;
    percent: number;
    ready: boolean;
  } | null;
  milestones: {
    id: string;
    key: string;
    title: string;
    body: string | null;
    week: number | null;
    celebratedBy: string[];
    createdAt: string;
  }[];
  sharedEvents: {
    id: string;
    type: string;
    severity: EventSeverityName;
    title: string;
    body: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string | null;
    read: boolean;
    created_at: string;
  }[];
  unread: number;
  currentCraving: {
    id: string;
    craving: string;
    category: string;
    intensity: number;
    relief: number;
    sweets_streak: number;
    updated_at: string;
  } | null;
  ultrasounds: { index: number; week: number; seen: boolean; unlockedAt: string; url: string }[];
  newUltrasounds: number;
  foods: {
    key: string;
    name: string;
    category: string;
    cravingRelief: number;
    note: string;
    deltas: Record<string, number>;
  }[];
  recentEvents: {
    event_type: string;
    title: string;
    body: string | null;
    choice: string | null;
    created_at: string;
  }[];
  popupFrequencyMinutes: number;
  nextEventAt: string | null;
  settings: Record<string, unknown>;
  serverTime: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export function journalPhotoSrc(photoUrl: string | null | undefined, token: string | null) {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  const url = new URL(photoUrl, "https://hud.local");
  if (token) url.searchParams.set("token", token);
  return `${url.pathname}${url.search}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

export async function resizeImageFile(file: File): Promise<{ data: string; mime: string }> {
  const img = await loadImage(file);
  const max = 1100;
  const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare that photo");
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  const comma = dataUrl.indexOf(",");
  return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, mime: "image/jpeg" };
}

export async function uploadJournalPhoto(token: string, file: File): Promise<{ id: string; url: string }> {
  const { data, mime } = await resizeImageFile(file);
  const res = await fetch("/api/hud/photo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, data, mime }),
  });
  const payload = (await res.json()) as { ok?: boolean; id?: string; url?: string; error?: string };
  if (!res.ok || !payload.id || !payload.url) {
    throw new Error(payload.error ?? "Photo upload failed");
  }
  return { id: payload.id, url: payload.url };
}

/**
 * How often to re-read server state.
 *
 * Both HUDs are pure readers of one authoritative pregnancy, so freshness is
 * everything during labor and almost nothing the rest of the time. A resting
 * pregnancy polls lazily; an active labor, an unanswered request or an
 * imminent birth tightens the loop. Nothing here ever polls per-second.
 */
export function pollIntervalFor(data: HudState | undefined): number {
  if (!data) return 15_000;
  const labor = data.pregnancy?.labor;
  if (labor?.phase === "pushing") return 3_000;
  if (labor?.inLabor) return 4_000;
  if (data.requests?.incoming?.length || data.requests?.outgoing?.length) return 4_000;
  if (labor?.phase === "prelabor") return 8_000;
  if (data.partner?.pendingLinks?.length) return 8_000;
  return 15_000;
}

export function useHudState(token: string | null) {
  return useQuery<HudState>({
    queryKey: ["hud-state", token],
    enabled: !!token,
    refetchInterval: (query) => pollIntervalFor(query.state.data),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 2_000,
    retry: 2,
    queryFn: async () => {
      if (!token) throw new Error("missing token");
      const res = await fetch(`/api/hud/state?token=${encodeURIComponent(token)}`);
      if (res.status === 401) throw new Error("unauthorized");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });
}

export interface ActionResponse {
  ok: boolean;
  message: string;
}

export function useHudAction(token: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ActionResponse, Error, { action: string; params?: Record<string, unknown> }>({
    mutationFn: async ({ action, params }) => {
      const res = await fetch("/api/hud/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action, params: params ?? {} }),
      });
      const data = (await res.json()) as ActionResponse & { error?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Action failed");
      return data;
    },
    // Keep the mutation pending until the fresh database-backed state has
    // arrived. Buttons and meters therefore settle on saved server data, not
    // a stale 15-second polling snapshot.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["hud-state", token] }),
  });
}
