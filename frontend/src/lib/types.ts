import type { FeatureCollection, Feature, Point } from "geojson";

// ── Tree types ──────────────────────────────────────────────────────────────

export interface TreeProperties {
  id: string;
  species: string;
  plantedYear: number;
  ageYears: number;
  moisture: number;
  heat: number;
  status: "thirsty" | "ok" | "watered";
  needsWater: boolean;
  lastWatered: string | null;
  neighborhood: string;
  litersPerDay: number;
}

export type TreeFeature = Feature<Point, TreeProperties>;
export type TreeFC = FeatureCollection<Point, TreeProperties>;

// ── Citizen / user types ────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  display_name: string;
  username: string | null;
  neighborhood: string | null;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  trees_adopted: number;
  waterings_count: number;
  level: number;
  badges: string[];
  favorite_trees: string[];
  created_at: string;
}

export interface RegisterBody {
  display_name: string;
  username?: string;
  email?: string;
  neighborhood?: string;
}

export interface LoginBody {
  username: string;
}

export interface TreeSummary {
  id: string;
  name: string;
  species: string | null;
  latitude: number;
  longitude: number;
  neighborhood: string | null;
  address: string | null;
  status: string;
  latest_moisture: number | null;
}

export interface WateringBody {
  tree_id: string;
  user_id?: string;
  estimated_liters?: number;
  photo_url?: string;
  notes?: string;
}

export interface WateringResult {
  id: string;
  tree_id: string;
  user_id: string | null;
  estimated_liters: number | null;
  points_earned: number;
  total_points: number;
  current_streak: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  neighborhood: string | null;
  total_points: number;
  level: number;
}

export interface LeaderboardOpts {
  neighborhood?: string;
  limit?: number;
}

// ── Reward types ────────────────────────────────────────────────────────────

export interface RewardDTO {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  category: string;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
}

export interface RedeemResult {
  success: boolean;
  redemption_id: string;
  points_spent: number;
  remaining_points: number;
  message: string;
}

// ── Gamification types ──────────────────────────────────────────────────────

export interface PointsInfo {
  user_id: string;
  total_points: number;
  level: number;
  points_to_next_level: number;
}

export interface StreakInfo {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_watering_at: string | null;
}

// ── City dashboard types ────────────────────────────────────────────────────

export type CityMetric = "noise" | "activity" | "heat" | "moisture";

export interface CityMapPoint {
  tree_id: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood: string;
  value: number;
}

export interface CityMapResponse {
  metric: CityMetric;
  days: number;
  points: CityMapPoint[];
}

export interface TimeSeriesPoint {
  t: string;
  value: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface TimeSeriesResponse {
  metric: CityMetric;
  bucket: "hour" | "day";
  days: number;
  series: TimeSeriesPoint[];
}

export interface ProfileBucket {
  bucket: number;
  label: string;
  value: number | null;
  count: number;
}

export interface ProfileResponse {
  metric: CityMetric;
  dimension: "hour_of_day" | "day_of_week";
  days: number;
  buckets: ProfileBucket[];
}

export interface ComparisonResponse {
  metric: CityMetric;
  pivot: string;
  tree_id: string | null;
  neighborhood: string | null;
  before_avg: number | null;
  after_avg: number | null;
  delta: number | null;
  delta_pct: number | null;
}

export interface MapFrame {
  idx: number;
  start: string;
  end: string;
  points: CityMapPoint[];
}

export interface MapFramesResponse {
  metric: CityMetric;
  window_days: number;
  total_days: number;
  n_frames: number;
  frames: MapFrame[];
}

export interface CityOverview {
  trees_monitored: number;
  active_sensors_24h: number;
  total_readings: number;
  neighborhoods_covered: number;
  health_pct: number;
  status_counts: { healthy: number; stressed: number; critical: number };
  current: {
    noise_level: number;
    noise_db: number | null;
    activity_total_7d: number;
    heat_avg_c: number;
    moisture_avg_pct: number;
  };
  anchor: string;
}
