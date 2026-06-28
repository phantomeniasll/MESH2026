import { apiFetch } from "./client";
import type {
  CityMapResponse,
  CityMetric,
  CityOverview,
  ComparisonResponse,
  MapFramesResponse,
  ProfileResponse,
  TimeSeriesResponse,
} from "@/lib/types";

export async function fetchCityOverview(): Promise<CityOverview> {
  return apiFetch<CityOverview>("/api/city/overview");
}

export async function fetchCityMap(metric: CityMetric, days = 7): Promise<CityMapResponse> {
  return apiFetch<CityMapResponse>(`/api/city/map?metric=${metric}&days=${days}`);
}

export async function fetchTimeSeries(
  metric: CityMetric,
  bucket: "hour" | "day" = "day",
  opts: { tree_id?: string; neighborhood?: string; days?: number } = {},
): Promise<TimeSeriesResponse> {
  const params = new URLSearchParams({ metric, bucket });
  if (opts.tree_id) params.set("tree_id", opts.tree_id);
  if (opts.neighborhood) params.set("neighborhood", opts.neighborhood);
  if (opts.days) params.set("days", String(opts.days));
  return apiFetch<TimeSeriesResponse>(`/api/city/timeseries?${params}`);
}

export async function fetchProfile(
  metric: CityMetric,
  dimension: "hour_of_day" | "day_of_week",
  opts: { tree_id?: string; neighborhood?: string; days?: number } = {},
): Promise<ProfileResponse> {
  const params = new URLSearchParams({ metric, dimension });
  if (opts.tree_id) params.set("tree_id", opts.tree_id);
  if (opts.neighborhood) params.set("neighborhood", opts.neighborhood);
  if (opts.days) params.set("days", String(opts.days));
  return apiFetch<ProfileResponse>(`/api/city/profile?${params}`);
}

export async function fetchCityMapFrames(
  metric: CityMetric,
  windowDays = 3,
  totalDays = 90,
): Promise<MapFramesResponse> {
  return apiFetch<MapFramesResponse>(
    `/api/city/map/frames?metric=${metric}&window_days=${windowDays}&total_days=${totalDays}`,
  );
}

export async function fetchComparison(
  metric: CityMetric,
  pivot: string,
  opts: { tree_id?: string; neighborhood?: string; days?: number } = {},
): Promise<ComparisonResponse> {
  const params = new URLSearchParams({ metric, pivot });
  if (opts.tree_id) params.set("tree_id", opts.tree_id);
  if (opts.neighborhood) params.set("neighborhood", opts.neighborhood);
  if (opts.days) params.set("days", String(opts.days));
  return apiFetch<ComparisonResponse>(`/api/city/comparison?${params}`);
}
