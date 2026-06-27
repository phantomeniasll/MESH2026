"use client";
import { useEffect } from "react";
import { useBetreeStore } from "@/store/useBetreeStore";
import { getFavorites } from "@/lib/api/citizens";

export const CITIZEN_STORAGE_KEY = "betree_user_id";

export function CitizenProvider({ children }: { children: React.ReactNode }) {
  const setUserId = useBetreeStore((s) => s.setUserId);
  const setFavorites = useBetreeStore((s) => s.setFavorites);
  const userId = useBetreeStore((s) => s.userId);

  useEffect(() => {
    const stored = localStorage.getItem(CITIZEN_STORAGE_KEY);
    if (stored) setUserId(stored);
  }, [setUserId]);

  useEffect(() => {
    if (!userId) return;
    getFavorites(userId)
      .then(setFavorites)
      .catch(() => {});
  }, [userId, setFavorites]);

  return <>{children}</>;
}
