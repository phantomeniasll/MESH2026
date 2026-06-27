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
