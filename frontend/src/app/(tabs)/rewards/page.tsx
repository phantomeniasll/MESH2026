"use client";
import { useState, useEffect } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { RewardCard } from "@/components/rewards/RewardCard";
import { REWARDS, type Reward } from "@/lib/mock/rewards";
import { useBetreeStore } from "@/store/useBetreeStore";
import { getDict } from "@/lib/i18n";
import { Flame } from "lucide-react";
import { listRewards, redeemReward as apiRedeemReward } from "@/lib/api/rewards";
import type { RewardDTO } from "@/lib/types";
import { toast } from "sonner";

function toViewReward(dto: RewardDTO): Reward {
  const iconMap: Record<string, string> = {
    food: "Leaf",
    transport: "Car",
    culture: "Music",
    civic: "Star",
  };
  return {
    id: dto.id,
    title: dto.name,
    titleDe: dto.name,
    description: dto.description,
    descriptionDe: dto.description,
    cost: dto.points_cost,
    icon: iconMap[dto.category] ?? "Gift",
    category: "civic",
  };
}

export default function RewardsPage() {
  const store = useBetreeStore();
  const { credits, streak, lang } = store;
  const userId = ((store as unknown) as { userId?: string | null }).userId ?? null;
  const t = getDict(lang);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRewards()
      .then((dtos) => {
        const active = dtos.filter((d) => d.is_active).map(toViewReward);
        setRewards(active.length > 0 ? active : REWARDS);
      })
      .catch(() => {
        setRewards(REWARDS);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRedeem = async (rewardId: string, cost: number) => {
    if (userId) {
      try {
        const result = await apiRedeemReward(userId, rewardId);
        useBetreeStore.setState({ credits: result.remaining_points });
        toast.success(result.message);
      } catch {
        toast.error("Redemption failed. Please try again.");
      }
    } else {
      const ok = store.redeemReward(cost);
      if (ok) {
        toast.success(t.redeemed);
      } else {
        toast.error("Not enough credits.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3">
        <Wordmark size="sm" />
      </div>
      <div className="px-4 pb-6 space-y-1">
        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t.credits}
            </p>
            <p className="font-heading text-5xl font-bold text-primary">{credits}</p>
          </div>
          <div className="mb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t.streak}
            </p>
            <div className="flex items-center gap-1">
              <Flame size={18} className="text-orange-500" />
              <p className="font-heading text-2xl font-semibold">{streak}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted animate-pulse rounded-xl h-24" />
            ))}
          </>
        ) : (
          rewards.map((r) => (
            <RewardCard key={r.id} reward={r} onRedeem={handleRedeem} />
          ))
        )}
      </div>
    </div>
  );
}
