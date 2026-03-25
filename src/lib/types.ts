export interface DailyLog {
  day: string;
  active_calories: number | null;
  total_calories: number | null;
  steps: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  readiness_score: number | null;
  food_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  workout_completed: number;
  workout_calories: number | null;
  workout_duration_min: number | null;
  workout_name: string | null;
  garmin_workout_calories: number | null;
  weight_lbs: number | null;
  water_oz: number | null;
  garmin_synced_at: string | null;
  chrono_synced_at: string | null;
  ladder_synced_at: string | null;
  updated_at: string;
}

export interface WeightEntry {
  id: number;
  day: string;
  weight_lbs: number;
  logged_at: string;
}

export interface BloodResult {
  id: number;
  marker: string;
  value: number;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  status: string | null;
  test_date: string;
}

export interface SyncStatus {
  garmin_configured: boolean;
  last_garmin_sync: string | null;
  last_chrono_sync: string | null;
  last_ladder_sync: string | null;
}
