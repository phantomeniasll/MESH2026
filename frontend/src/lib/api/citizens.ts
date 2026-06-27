import { apiFetch } from "./client";
import type {
  UserProfile,
  RegisterBody,
  LoginBody,
  WateringBody,
  WateringResult,
  LeaderboardEntry,
  LeaderboardOpts,
} from "@/lib/types";

export async function registerCitizen(body: RegisterBody): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/citizens/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function loginCitizen(body: LoginBody): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/citizens/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function logWatering(body: WateringBody): Promise<WateringResult> {
  return apiFetch<WateringResult>("/api/citizens/water", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getProfile(userId: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(
    `/api/citizens/profile/${encodeURIComponent(userId)}`,
  );
}

export async function getFavorites(userId: string): Promise<string[]> {
  return apiFetch<string[]>(`/api/citizens/${encodeURIComponent(userId)}/favorites`);
}

export async function addFavorite(userId: string, treeId: string): Promise<void> {
  await apiFetch(`/api/citizens/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(treeId)}`, {
    method: "POST",
  });
}

export async function removeFavorite(userId: string, treeId: string): Promise<void> {
  await apiFetch(`/api/citizens/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(treeId)}`, {
    method: "DELETE",
  });
}

export async function getLeaderboard(
  opts: LeaderboardOpts = {},
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams();
  if (opts.neighborhood) params.set("neighborhood", opts.neighborhood);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiFetch<LeaderboardEntry[]>(`/api/citizens/leaderboard${qs ? `?${qs}` : ""}`);
}
