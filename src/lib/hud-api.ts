// Client-side API for the HUD dashboard. The session token comes from the
// MOAP URL (?token=...) that the in-world HUD sets on its screen face.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface HudStats {
  energy: number; hydration: number; hunger: number; bladder: number;
  mood: number; immunity: number; sickness: number; rest: number;
  vitamins: number; comfort: number; nutrition: number; stress: number;
  baby_wellness: number; baby_bond: number; baby_movement: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string | null;
  kind: "note" | "milestone" | "memory" | "appointment";
  completed: boolean;
  entry_date: string;
  created_at: string;
}

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
    baby: {
      size: string; lengthCm: number; weightG: number; note: string;
      heartbeat: number; kicksToday: number; position: string; movement: string;
      wellness: number; bond: number; movementScore: number;
    };
  };
  stats: HudStats;
  wellness: number;
  symptoms: { name: string; severity: number; label: string }[];
  journal: JournalEntry[];
  partner: {
    name: string | null;
    linked: boolean;
    code: string;
    support: number;
    activities: { actor_name: string; activity: string; created_at: string }[];
  };
  notifications: { id: string; title: string; body: string | null; read: boolean; created_at: string }[];
  unread: number;
  currentCraving: {
    id: string; craving: string; category: string; intensity: number;
    relief: number; sweets_streak: number; updated_at: string;
  } | null;
  foods: {
    key: string;
    name: string;
    category: string;
    cravingRelief: number;
    note: string;
    deltas: Record<string, number>;
  }[];
  recentEvents: { event_type: string; title: string; body: string | null; choice: string | null; created_at: string }[];
  popupFrequencyMinutes: number;
  nextEventAt: string | null;
  settings: Record<string, unknown>;
  serverTime: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export function useHudState(token: string | null) {
  return useQuery<HudState>({
    queryKey: ["hud-state", token],
    enabled: !!token,
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await fetch(`/api/hud/state?token=${encodeURIComponent(token!)}`);
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
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["hud-state", token] });
    },
  });
}
