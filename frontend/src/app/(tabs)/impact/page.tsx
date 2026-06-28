"use client";
import { useState, useEffect, useCallback } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { StatTile } from "@/components/impact/StatTile";
import { StreakHeatmap } from "@/components/impact/StreakHeatmap";
import { useBetreeStore } from "@/store/useBetreeStore";
import { getDict } from "@/lib/i18n";
import { Droplets, Wind, Leaf, Flame, Trophy, Medal } from "lucide-react";
import { getProfile, getLeaderboard } from "@/lib/api/citizens";
import type { UserProfile, LeaderboardEntry } from "@/lib/types";

const BADGE_META: Record<string, { name: string; icon: string; desc: string }> = {
  first_drop:        { name: "First Drop",       icon: "💧", desc: "First tree watered" },
  early_bird:        { name: "Early Bird",        icon: "🌅", desc: "Watered before 7 am" },
  heat_wave_hero:    { name: "Heat Wave Hero",    icon: "🦸", desc: "3 days in a row during heat" },
  sniper:            { name: "Sniper",            icon: "🎯", desc: "Helped the most critical tree" },
  neighborhood_king: { name: "Neigh. King",       icon: "👑", desc: "Top of your neighborhood" },
  centurion:         { name: "Centurion",         icon: "💯", desc: "100 waterings" },
  night_owl:         { name: "Night Owl",         icon: "🦉", desc: "Watered after 10 pm" },
  paparazzo:         { name: "Paparazzo",         icon: "📸", desc: "10 tree photos" },
  recruiter:         { name: "Recruiter",         icon: "🤝", desc: "Referred a friend" },
};

const IMPACT_TAB_KEY = "betree_impact_tab";
type ImpactTab = "overview" | "streak" | "badges" | "leaderboard" | "carbon";
const TABS: { id: ImpactTab; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "streak",      label: "Streak" },
  { id: "badges",      label: "Badges" },
  { id: "leaderboard", label: "Ranking" },
  { id: "carbon",      label: "Carbon" },
];

export default function ImpactPage() {
  const store = useBetreeStore();
  const { wateredTreeIds, wateringDays, lang } = store;
  const userId = ((store as unknown) as { userId?: string | null }).userId ?? null;
  const t = getDict(lang);

  const [tab, setTab] = useState<ImpactTab>(() => {
    if (typeof window === "undefined") return "overview";
    const saved = localStorage.getItem(IMPACT_TAB_KEY) as ImpactTab | null;
    return saved && TABS.some((t2) => t2.id === saved) ? saved : "overview";
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const changeTab = useCallback((id: ImpactTab) => {
    setTab(id);
    localStorage.setItem(IMPACT_TAB_KEY, id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(setProfile).catch(() => {});
  }, [userId]);

  useEffect(() => {
    getLeaderboard({ limit: 10 }).then(setLeaderboard).catch(() => {});
  }, []);

  const count = profile ? profile.waterings_count : wateredTreeIds.size;
  const liters = count * 15;
  const co2kg = count * 8;
  const coolingKwh = Math.round(liters * 0.7);
  const streakVal = profile?.current_streak ?? store.streak;
  const longestStreak = Math.max(profile?.longest_streak ?? 0, streakVal);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3">
        <Wordmark size="sm" />
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
        {TABS.map((t2) => (
          <button
            key={t2.id}
            onClick={() => changeTab(t2.id)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${tab === t2.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          >
            {t2.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <>
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <StatTile icon={<Droplets size={18} />} label={t.treesWatered} value={String(count)} />
            <StatTile icon={<Droplets size={18} />} label={t.litersDelivered} value={`${liters} L`} sub="@ 15 L / tree" />
            <StatTile icon={<Wind size={18} />} label={t.coolingProxy} value={`${coolingKwh} kWh`} sub="Estimated" />
            <StatTile icon={<Leaf size={18} />} label={t.co2Proxy} value={`${co2kg} kg`} sub="CO₂ / year" />
          </div>
          <div className="px-4 pb-4">
            <div className="bg-card border border-border rounded-xl p-4 flex gap-6 justify-around text-center">
              <div>
                <p className="font-heading text-2xl font-bold text-primary">{streakVal}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current streak</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="font-heading text-2xl font-bold text-primary">{longestStreak}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Best streak</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="font-heading text-2xl font-bold text-primary">{profile?.trees_adopted ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Trees adopted</p>
              </div>
            </div>
          </div>
          <p className="px-4 pb-6 text-xs text-muted-foreground text-center">{t.civicLine}</p>
        </>
      )}

      {/* Tab: Streak */}
      {tab === "streak" && (
        <div className="px-4 pb-6 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-orange-500" />
              <p className="text-sm font-semibold">Activity calendar</p>
            </div>
            <StreakHeatmap wateringDays={wateringDays} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame size={16} className="text-orange-500" />
                <p className="font-heading text-2xl font-bold text-orange-500">{streakVal}</p>
              </div>
              <p className="text-xs text-muted-foreground">Current streak</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="font-heading text-2xl font-bold text-primary">{longestStreak}</p>
              <p className="text-xs text-muted-foreground mt-1">Best streak</p>
            </div>
          </div>

          {streakVal === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-800 dark:text-amber-200">No streak active. Water a tree today to start one! 🌱</p>
            </div>
          )}
          {streakVal >= 3 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                🔥 On fire! {streakVal} days running — keep going!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Badges */}
      {tab === "badges" && (
        <div className="px-4 pb-6">
          {!userId && (
            <p className="text-xs text-muted-foreground mb-3 text-center">
              Log in to see your earned badges.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {Object.entries(BADGE_META).map(([id, meta]) => {
              const earned = profile?.badges.includes(id) ?? false;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${earned ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-50"}`}
                >
                  <span className="text-xl shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{meta.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                  </div>
                  {earned && <Medal size={14} className="text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Leaderboard */}
      {tab === "leaderboard" && (
        <div className="px-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Top 10 — All time</p>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
          ) : (
            <div className="bg-card border border-border rounded-xl px-4 divide-y divide-border">
              {leaderboard.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 py-3 ${entry.user_id === userId ? "text-primary" : ""}`}
                >
                  <span className="text-base w-6 text-center shrink-0">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.display_name}{entry.user_id === userId ? " 👈" : ""}
                    </p>
                    {entry.neighborhood && (
                      <p className="text-xs text-muted-foreground truncate">{entry.neighborhood}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">Lv {entry.level}</span>
                  <span className="text-sm font-heading font-bold text-primary shrink-0">{entry.total_points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Carbon */}
      {tab === "carbon" && (
        <div className="px-4 pb-6 space-y-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
            <Leaf size={24} className="text-emerald-600 mx-auto mb-2" />
            <p className="font-heading text-3xl font-bold text-emerald-700 dark:text-emerald-400">{co2kg} kg</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">CO₂ absorbed / year</p>
            <p className="text-xs text-muted-foreground mt-1">Across {count} waterings · ~8 kg CO₂ per tree</p>
          </div>

          <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 text-center">
            <Wind size={24} className="text-sky-500 mx-auto mb-2" />
            <p className="font-heading text-3xl font-bold text-sky-600 dark:text-sky-400">{coolingKwh} kWh</p>
            <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">Cooling effect equivalent</p>
            <p className="text-xs text-muted-foreground mt-1">Evapotranspiration proxy · 0.7 kWh per litre</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Droplets size={24} className="text-blue-500 mx-auto mb-2" />
            <p className="font-heading text-3xl font-bold">{liters} L</p>
            <p className="text-sm text-muted-foreground mt-1">Water delivered</p>
            <p className="text-xs text-muted-foreground mt-1">Estimated 15 L per watering session</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Urban trees reduce surface temperatures by 2–8°C. Each mature tree absorbs 8–22 kg CO₂/year and releases ~400 L of water through evapotranspiration on hot days.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
