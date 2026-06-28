"use client";
import { useState, useEffect } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { SettingRow } from "@/components/profile/SettingRow";
import { Switch } from "@/components/ui/switch";
import { useBetreeStore } from "@/store/useBetreeStore";
import { getDict } from "@/lib/i18n";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Flame, Heart, Medal, LogOut, ChevronRight } from "lucide-react";
import {
  getProfile,
  getLeaderboard,
  registerCitizen,
  loginCitizen,
} from "@/lib/api/citizens";
import { CITIZEN_STORAGE_KEY } from "@/components/providers/CitizenProvider";
import type { UserProfile, LeaderboardEntry } from "@/lib/types";

const BADGE_META: Record<string, { name: string; icon: string; desc: string }> = {
  first_drop:        { name: "First Drop",           icon: "💧", desc: "First tree watered" },
  early_bird:        { name: "Early Bird",            icon: "🌅", desc: "Watered before 7 am" },
  heat_wave_hero:    { name: "Heat Wave Hero",        icon: "🦸", desc: "3 days in a row during heat" },
  sniper:            { name: "Sniper",                icon: "🎯", desc: "Helped the most critical tree" },
  neighborhood_king: { name: "Neighborhood King",     icon: "👑", desc: "Top of your neighborhood" },
  centurion:         { name: "Centurion",             icon: "💯", desc: "100 waterings" },
  night_owl:         { name: "Night Owl",             icon: "🦉", desc: "Watered after 10 pm" },
  paparazzo:         { name: "Paparazzo",             icon: "📸", desc: "10 tree photos uploaded" },
  recruiter:         { name: "Recruiter",             icon: "🤝", desc: "Referred a friend" },
};

type AuthMode = "login" | "register";
type ProfileTab = "overview" | "badges" | "favorites";

export default function ProfilePage() {
  const store = useBetreeStore();
  const { lang, setLang, units, setUnits, defaultOverlay, setDefaultOverlay, credits, streak, favorites } = store;
  const userId = ((store as unknown) as { userId?: string | null }).userId ?? null;
  const setUserId = useBetreeStore((s) => s.setUserId);
  const setFavorites = useBetreeStore((s) => s.setFavorites);
  const t = getDict(lang);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<ProfileTab>("overview");

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!uname) return;
    setLoading(true);
    setError(null);
    try {
      const p = await loginCitizen({ username: uname });
      localStorage.setItem(CITIZEN_STORAGE_KEY, p.id);
      setUserId(p.id);
      if (p.favorite_trees) setFavorites(p.favorite_trees);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      setError(status === 404 ? "Username not found. Try registering." : "Login failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase().replace(/\s+/g, "_");
    const name = displayName.trim() || uname;
    if (!uname || uname.length < 2) { setError("Username must be at least 2 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      const p = await registerCitizen({
        username: uname,
        display_name: name,
        neighborhood: neighborhood || undefined,
      });
      localStorage.setItem(CITIZEN_STORAGE_KEY, p.id);
      setUserId(p.id);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      setError(status === 409 ? "Username already taken. Try another." : "Registration failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(CITIZEN_STORAGE_KEY);
    setUserId("");
    setProfile(null);
    setFavorites([]);
  }

  useEffect(() => {
    getLeaderboard({ limit: 10 }).then(setLeaderboard).catch(() => {});
    if (userId) {
      getProfile(userId).then((p) => {
        setProfile(p);
        if (p.favorite_trees) setFavorites(p.favorite_trees);
      }).catch(() => {});
    }
  }, [userId, setFavorites]);

  const displayName2 = profile?.display_name ?? "Anonymous";
  const nbhd = profile?.neighborhood ?? null;
  const totalPoints = profile?.total_points ?? credits;
  const currentStreak = profile?.current_streak ?? streak;
  const bestStreak = Math.max(profile?.longest_streak ?? 0, currentStreak);
  const level = profile?.level ?? 1;
  const initials = displayName2.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const prevThresh = ((level - 1) * (level - 1)) * 100;
  const nextThresh = (level * level) * 100;
  const pct = Math.min(100, Math.round(((totalPoints - prevThresh) / (nextThresh - prevThresh)) * 100));

  // ── Not logged in ──
  if (!userId) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-4 py-3">
          <Wordmark size="sm" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-6 gap-4">
          <div className="text-center">
            <p className="font-heading text-2xl font-semibold text-primary mb-1">
              {authMode === "login" ? "Welcome back" : "Join BeTree"}
            </p>
            <p className="text-sm text-muted-foreground">
              {authMode === "login"
                ? "Enter your username to continue."
                : "Create your account to track your impact."}
            </p>
          </div>

          {/* Mode switcher */}
          <div className="flex w-full max-w-xs border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => { setAuthMode("login"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Login
            </button>
            <button
              onClick={() => { setAuthMode("register"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${authMode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Register
            </button>
          </div>

          <form
            onSubmit={authMode === "login" ? handleLogin : handleRegister}
            className="w-full max-w-xs flex flex-col gap-3"
          >
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Username</label>
              <input
                type="text"
                placeholder={authMode === "login" ? "your_username" : "choose_username"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            {authMode === "register" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Display name</label>
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Neighborhood</label>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— select —</option>
                    {["Innenstadt","Südstadt","Weststadt","Oststadt","Nordstadt","Südweststadt","Mühlburg","Durlach","Neureut","Waldstadt"].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-opacity"
            >
              {loading ? (authMode === "login" ? "Signing in…" : "Creating account…") : (authMode === "login" ? "Sign in" : "Create account")}
            </button>
          </form>

          {/* Demo chips */}
          <div className="w-full max-w-xs">
            <p className="text-xs text-muted-foreground mb-2 text-center">Demo accounts (tap to login):</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {["emma_mueller","leon_wagner","hannah_klein","mia_fischer","sofia_hoffmann","noah_schneider"].map(u => (
                <button
                  key={u}
                  onClick={() => { setAuthMode("login"); setUsername(u); }}
                  className="text-xs border border-border rounded-full px-3 py-1 hover:border-primary hover:text-primary transition-colors"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Logged in ──
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 flex items-center justify-between">
        <Wordmark size="sm" />
        <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {/* Profile header */}
      <div className="px-4 pb-4 flex items-center gap-4">
        <Avatar className="w-16 h-16 border-2 border-primary">
          <AvatarFallback className="bg-primary text-primary-foreground font-heading text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg leading-tight truncate">{displayName2}</p>
          {profile?.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
          {nbhd && <p className="text-xs text-muted-foreground">{nbhd} · Karlsruhe</p>}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">Lv {level}</span>
            <span className="text-xs text-muted-foreground">{totalPoints.toLocaleString()} pts</span>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Flame size={12} className="text-orange-500" />
              {currentStreak} day streak
            </span>
          </div>
        </div>
      </div>

      {/* Level progress bar */}
      <div className="px-4 pb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Level {level}</span>
          <span>{totalPoints - prevThresh} / {nextThresh - prevThresh} XP → Lv {level + 1}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-bold text-primary">{profile?.waterings_count ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Waterings</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-bold text-primary">{profile?.trees_adopted ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Trees adopted</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-bold text-primary">{bestStreak}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Best streak</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="font-heading text-2xl font-bold text-primary">{favorites.size}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Favorites</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 flex gap-2">
        {(["overview", "badges", "favorites"] as ProfileTab[]).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${tab === t2 ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
          >
            {t2 === "overview" ? "Overview" : t2 === "badges" ? `Badges (${profile?.badges.length ?? 0})` : `Favorites (${favorites.size})`}
          </button>
        ))}
      </div>

      {/* Tab: Overview = leaderboard + settings */}
      {tab === "overview" && (
        <>
          {leaderboard.length > 0 && (
            <div className="px-4 pt-2 pb-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Leaderboard</p>
              <div className="bg-card border border-border rounded-xl px-4 divide-y divide-border">
                {leaderboard.map((entry) => (
                  <div key={entry.user_id} className={`flex items-center gap-3 py-2.5 ${entry.user_id === userId ? "text-primary" : ""}`}>
                    <span className="text-xs text-muted-foreground w-5 text-right">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}</span>
                    <span className="flex-1 text-sm font-medium truncate">
                      {entry.display_name}{entry.user_id === userId ? " 👈" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.neighborhood}</span>
                    <span className="text-sm font-heading font-semibold text-primary">{entry.total_points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 pb-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{t.settings}</p>
            <div className="bg-card border border-border rounded-xl px-4">
              <SettingRow label={t.language}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={lang === "de" ? "font-semibold" : "text-muted-foreground"}>DE</span>
                  <Switch checked={lang === "en"} onCheckedChange={(v) => setLang(v ? "en" : "de")} />
                  <span className={lang === "en" ? "font-semibold" : "text-muted-foreground"}>EN</span>
                </div>
              </SettingRow>
              <SettingRow label={t.units}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={units === "l" ? "font-semibold" : "text-muted-foreground"}>L</span>
                  <Switch checked={units === "gal"} onCheckedChange={(v) => setUnits(v ? "gal" : "l")} />
                  <span className={units === "gal" ? "font-semibold" : "text-muted-foreground"}>gal</span>
                </div>
              </SettingRow>
              <SettingRow label={t.defaultOverlay}>
                <select
                  value={defaultOverlay}
                  onChange={(e) => setDefaultOverlay(e.target.value as "none" | "moisture" | "heat")}
                  className="text-sm bg-background border border-border rounded-md px-2 py-1"
                >
                  <option value="none">{t.overlayNone}</option>
                  <option value="moisture">{t.overlayMoisture}</option>
                  <option value="heat">{t.overlayHeat}</option>
                </select>
              </SettingRow>
            </div>
          </div>
        </>
      )}

      {/* Tab: Badges */}
      {tab === "badges" && (
        <div className="px-4 pt-2 pb-6">
          <div className="flex flex-col gap-2">
            {Object.entries(BADGE_META).map(([id, meta]) => {
              const earned = profile?.badges.includes(id);
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

      {/* Tab: Favorites */}
      {tab === "favorites" && (
        <div className="px-4 pt-2 pb-6">
          {favorites.size === 0 ? (
            <div className="text-center py-8">
              <Heart size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No favorites yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the heart on any tree on the map.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...favorites].map((treeId) => (
                <div key={treeId} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <span className="text-lg">🌳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{treeId}</p>
                    <p className="text-xs text-muted-foreground">Favorited tree</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
