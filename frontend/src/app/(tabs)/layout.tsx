"use client";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { ScanSheet } from "@/components/scan/ScanSheet";
import { CitizenProvider } from "@/components/providers/CitizenProvider";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <CitizenProvider>
      <div className="flex flex-col h-dvh standalone:h-lvh pt-[env(safe-area-inset-top)]">
        <main className="flex-1 relative overflow-hidden pb-16">{children}</main>
        <BottomTabBar />
        <ScanSheet />
      </div>
    </CitizenProvider>
  );
}
