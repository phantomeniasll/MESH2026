"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flower2, Landmark, Train, CalendarCheck, Leaf, Car, Music, Star, Gift, Waves } from "lucide-react";
import type { Reward } from "@/lib/mock/rewards";
import { useBetreeStore } from "@/store/useBetreeStore";
import { getDict } from "@/lib/i18n";
import { toast } from "sonner";
import type { LucideProps } from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  Flower2,
  Landmark,
  Train,
  CalendarCheck,
  Leaf,
  Car,
  Music,
  Star,
  Gift,
  Waves,
};

interface Props {
  reward: Reward;
  onRedeem?: (rewardId: string, cost: number) => void;
}

export function RewardCard({ reward, onRedeem }: Props) {
  const { credits, redeemReward, lang } = useBetreeStore();
  const t = getDict(lang);
  const Icon = ICONS[reward.icon] ?? Flower2;
  const canAfford = credits >= reward.cost;
  const title = lang === "de" ? reward.titleDe : reward.title;
  const desc = lang === "de" ? reward.descriptionDe : reward.description;

  const handleRedeem = () => {
    if (onRedeem) {
      onRedeem(reward.id, reward.cost);
      return;
    }
    if (redeemReward(reward.cost)) {
      toast.success(`${t.redeemed} ${title}`);
    } else {
      toast.error("Nicht genug Credits.");
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-heading font-semibold">
            {reward.cost} Credits
          </Badge>
          <Button size="sm" disabled={!canAfford} onClick={handleRedeem}>
            {t.redeem}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
