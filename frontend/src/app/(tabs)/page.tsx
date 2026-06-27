"use client";
import dynamic from "next/dynamic";
import { useBetreeStore } from "@/store/useBetreeStore";
import RewardsPage from "./rewards/page";
import ImpactPage from "./impact/page";
import ProfilePage from "./profile/page";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-accent animate-pulse" />,
});

export default function SpaRoot() {
  const activeTab = useBetreeStore((s) => s.activeTab);

  return (
    <div className="relative w-full h-full">
      <div className={`w-full h-full ${activeTab === "map" ? "" : "hidden"}`}>
        <MapView />
      </div>
      <div className={`w-full h-full ${activeTab === "rewards" ? "" : "hidden"}`}>
        <RewardsPage />
      </div>
      <div className={`w-full h-full ${activeTab === "impact" ? "" : "hidden"}`}>
        <ImpactPage />
      </div>
      <div className={`w-full h-full ${activeTab === "profile" ? "" : "hidden"}`}>
        <ProfilePage />
      </div>
    </div>
  );
}
