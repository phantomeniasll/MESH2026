"use client";
import { create } from "zustand";
import type { Lang } from "@/lib/i18n";
import type { TreeFC, WateringResult } from "@/lib/types";
import { logWatering, addFavorite, removeFavorite } from "@/lib/api/citizens";

export type ScanPhase =
  | "idle"
  | "picking-method"
  | "scanning-qr"
  | "scanning-nfc"
  | "verifying"
  | "verified"
  | "rejected";

export type Overlay = "none" | "moisture" | "heat";
export type ActiveTab = "map" | "rewards" | "impact" | "profile";

interface BetreeState {
  appReady: boolean;
  setAppReady: () => void;
  userId: string | null;
  setUserId: (id: string) => void;
  credits: number;
  streak: number;
  wateringDays: Set<string>;
  wateredTreeIds: Set<string>;
  mapTreesFC: TreeFC | null;
  setMapTreesFC: (fc: TreeFC) => void;
  scanPhase: ScanPhase;
  scanTreeId: string | null;
  scanMode: "sim" | "live";
  setScanMode: (mode: "sim" | "live") => void;
  rejectionReason: string | null;
  selectedTreeId: string | null;
  activeTab: ActiveTab;
  lang: Lang;
  units: "l" | "gal";
  defaultOverlay: Overlay;
  favorites: Set<string>;
  setFavorites: (ids: string[]) => void;
  toggleFavorite: (treeId: string) => Promise<void>;
  userLat: number | null;
  userLng: number | null;
  setUserLocation: (lat: number, lng: number) => void;
  navigateTarget: { lat: number; lng: number; treeId: string } | null;
  setNavigateTarget: (target: { lat: number; lng: number; treeId: string } | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  openScanFor: (treeId: string | null) => void;
  closeScan: () => void;
  setScanPhase: (phase: ScanPhase) => void;
  setScanTreeId: (id: string) => void;
  setRejectionReason: (reason: string | null) => void;
  confirmWatering: (treeId: string) => Promise<WateringResult | null>;
  resetWatered: (treeId: string) => void;
  rejectWatering: (reason: string) => void;
  redeemReward: (cost: number) => boolean;
  setSelectedTree: (id: string | null) => void;
  setLang: (lang: Lang) => void;
  setUnits: (units: "l" | "gal") => void;
  setDefaultOverlay: (overlay: Overlay) => void;
}

export const useBetreeStore = create<BetreeState>((set, get) => ({
  appReady: false,
  setAppReady: () => set({ appReady: true }),
  userId: null,
  setUserId: (id) => set({ userId: id }),
  credits: 75,
  streak: 3,
  wateringDays: new Set(["2026-06-25", "2026-06-26"]),
  wateredTreeIds: new Set(),
  mapTreesFC: null,
  setMapTreesFC: (fc) => set({ mapTreesFC: fc }),
  scanPhase: "idle",
  scanTreeId: null,
  scanMode: "sim",
  setScanMode: (mode) => set({ scanMode: mode }),
  rejectionReason: null,
  selectedTreeId: null,
  activeTab: "map",
  lang: "en",
  units: "l",
  defaultOverlay: "none",
  favorites: new Set(),
  userLat: null,
  userLng: null,

  setFavorites: (ids) => set({ favorites: new Set(ids) }),

  toggleFavorite: async (treeId) => {
    const { userId, favorites } = get();
    if (!userId) return;
    const isFav = favorites.has(treeId);
    const next = new Set(favorites);
    if (isFav) {
      next.delete(treeId);
      set({ favorites: next });
      await removeFavorite(userId, treeId).catch(() => {
        set({ favorites: favorites });
      });
    } else {
      next.add(treeId);
      set({ favorites: next });
      await addFavorite(userId, treeId).catch(() => {
        set({ favorites: favorites });
      });
    }
  },

  navigateTarget: null,
  setNavigateTarget: (target) => set({ navigateTarget: target }),

  setUserLocation: (lat, lng) => set({ userLat: lat, userLng: lng }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  openScanFor: (treeId) =>
    set({ scanPhase: "picking-method", scanTreeId: treeId, scanMode: "sim", rejectionReason: null }),
  closeScan: () => set({ scanPhase: "idle", scanTreeId: null, scanMode: "sim", rejectionReason: null }),
  setScanPhase: (phase) => set({ scanPhase: phase }),
  setScanTreeId: (id) => set({ scanTreeId: id }),
  setRejectionReason: (reason) => set({ rejectionReason: reason }),

  confirmWatering: async (treeId) => {
    const today = "2026-06-27";
    const { userId } = get();
    try {
      const result = await logWatering({
        tree_id: treeId,
        user_id: userId ?? undefined,
      });
      set((s) => ({
        credits: result.total_points,
        streak: result.current_streak,
        wateringDays: new Set([...s.wateringDays, today]),
        wateredTreeIds: new Set([...s.wateredTreeIds, treeId]),
        scanPhase: "verified",
      }));
      return result;
    } catch (err) {
      console.error("[confirmWatering] API error, using local fallback:", err);
      set((s) => ({
        credits: s.credits + 25,
        streak: s.streak + 1,
        wateringDays: new Set([...s.wateringDays, today]),
        wateredTreeIds: new Set([...s.wateredTreeIds, treeId]),
        scanPhase: "verified",
      }));
      return null;
    }
  },

  // Demo helper: un-mark a tree as watered so it's testable again.
  resetWatered: (treeId) =>
    set((s) => {
      const next = new Set(s.wateredTreeIds);
      next.delete(treeId);
      return { wateredTreeIds: next };
    }),

  rejectWatering: (reason) =>
    set({ scanPhase: "rejected", rejectionReason: reason }),

  redeemReward: (cost) => {
    if (get().credits < cost) return false;
    set((s) => ({ credits: s.credits - cost }));
    return true;
  },

  setSelectedTree: (id) => set({ selectedTreeId: id }),
  setLang: (lang) => set({ lang }),
  setUnits: (units) => set({ units }),
  setDefaultOverlay: (overlay) => set({ defaultOverlay: overlay }),
}));
