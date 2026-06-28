"use client";
import { useEffect, useState } from "react";
import { fetchTreeForecast, type TreeForecast } from "@/lib/api/trees";

/**
 * Fetch a tree's hybrid water-balance forecast. Tracks which tree the result is
 * for so `loading` is derived (no setState in the effect body) and stale
 * responses from a previously selected tree are ignored.
 */
export function useTreeForecast(
  treeId: string,
  lat?: number,
  lng?: number,
  age?: number,
  species?: string | null,
): { forecast: TreeForecast | null; loading: boolean } {
  const [result, setResult] = useState<{ forId: string; data: TreeForecast | null }>({
    forId: "",
    data: null,
  });

  useEffect(() => {
    if (!treeId) return;
    let alive = true;
    fetchTreeForecast(treeId, { lat, lng, age, species })
      .then((data) => alive && setResult({ forId: treeId, data }))
      .catch(() => alive && setResult({ forId: treeId, data: null }));
    return () => {
      alive = false;
    };
  }, [treeId, lat, lng, age, species]);

  const loading = !treeId || result.forId !== treeId;
  return { forecast: loading ? null : result.data, loading };
}
