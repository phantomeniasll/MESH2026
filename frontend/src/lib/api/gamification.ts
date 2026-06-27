import { apiFetch } from "./client";
import type { PointsInfo, StreakInfo } from "@/lib/types";

export async function getPoints(userId: string): Promise<PointsInfo> {
  return apiFetch<PointsInfo>(
    `/api/gamification/points/${encodeURIComponent(userId)}`,
  );
}

export async function getStreak(userId: string): Promise<StreakInfo> {
  return apiFetch<StreakInfo>(
    `/api/gamification/streak/${encodeURIComponent(userId)}`,
  );
}
