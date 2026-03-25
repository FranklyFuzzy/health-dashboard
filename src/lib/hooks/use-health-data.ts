import useSWR, { preload } from "swr";
import type { DailyLog, WeightEntry, BloodResult } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

if (typeof window !== "undefined") {
  preload("/api/daily", fetcher);
}

export function useDailyLogs() {
  return useSWR<DailyLog[]>("/api/daily", fetcher);
}

export function useToday() {
  const today = localToday();
  return useSWR<DailyLog | null>(`/api/daily?day=${today}`, fetcher);
}

export function useDay(day: string) {
  return useSWR<DailyLog | null>(`/api/daily?day=${day}`, fetcher);
}

export { localToday };

export function useWeightHistory() {
  return useSWR<WeightEntry[]>("/api/weight", fetcher);
}

export function useBloodwork() {
  return useSWR<BloodResult[]>("/api/bloodwork", fetcher);
}

export function useSyncStatus() {
  return useSWR<{ garmin_configured: boolean; last_garmin_sync: string | null; last_chrono_sync: string | null; last_ladder_sync: string | null }>("/api/garmin-status", fetcher);
}
