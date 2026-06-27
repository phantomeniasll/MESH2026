import { apiFetch } from "./client";
import type { RewardDTO, RedeemResult } from "@/lib/types";

export async function listRewards(category?: string): Promise<RewardDTO[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<RewardDTO[]>(`/api/rewards${qs}`);
}

export async function redeemReward(
  userId: string,
  rewardId: string,
): Promise<RedeemResult> {
  return apiFetch<RedeemResult>("/api/rewards/redeem", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, reward_id: rewardId }),
  });
}
