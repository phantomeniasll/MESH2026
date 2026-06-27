"use client";
import { Map, Gift, Leaf, User } from "lucide-react";
import { ScanFab } from "./ScanFab";
import { useBetreeStore, type ActiveTab } from "@/store/useBetreeStore";
import { getDict } from "@/lib/i18n";

export function BottomTabBar() {
  const activeTab = useBetreeStore((s) => s.activeTab);
  const setActiveTab = useBetreeStore((s) => s.setActiveTab);
  const lang = useBetreeStore((s) => s.lang);
  const t = getDict(lang);

  const tabs: { id: ActiveTab; label: string; icon: typeof Map }[] = [
    { id: "map", label: t.map, icon: Map },
    { id: "rewards", label: t.rewards, icon: Gift },
  ];
  const tabs2: { id: ActiveTab; label: string; icon: typeof Map }[] = [
    { id: "impact", label: t.impact, icon: Leaf },
    { id: "profile", label: t.profile, icon: User },
  ];

  const btnClass = (id: ActiveTab) =>
    `flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
      activeTab === id ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[200] bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end justify-around px-2 pt-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={btnClass(id)}>
            <Icon size={22} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
        <ScanFab />
        {tabs2.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={btnClass(id)}>
            <Icon size={22} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
