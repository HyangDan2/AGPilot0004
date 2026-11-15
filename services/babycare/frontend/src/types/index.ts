export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChildMember {
  id: string;
  user_id: string;
  role: 'owner' | 'caregiver' | 'viewer';
  user_name?: string;
  user_email?: string;
  invited_at: string;
}

export interface Child {
  id: string;
  name: string;
  birth_date: string;
  sex: 'male' | 'female';
  is_premature: boolean;
  due_date?: string;
  gestational_weeks?: number;
  profile_image_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role: 'owner' | 'caregiver' | 'viewer';
  members: ChildMember[];
  days_since_birth?: number;
  months_since_birth?: number;
  corrected_age_months?: number;
}

export interface GrowthRecord {
  id: string;
  child_id: string;
  measurement_date: string;
  weight_kg?: number;
  height_cm?: number;
  head_circumference_cm?: number;
  weight_percentile?: number;
  height_percentile?: number;
  head_circumference_percentile?: number;
  notes?: string;
  measurement_method?: string;
  created_at: string;
}

export interface GrowthCurvePoint {
  age_months: number;
  p3: number;
  p50: number;
  p97: number;
}

export interface GrowthCurvesResponse {
  metric: string;
  standard_name: string;
  points: GrowthCurvePoint[];
}

export interface GrowthSummary {
  latest_record?: GrowthRecord;
  previous_record?: GrowthRecord;
  weight_change_kg?: number;
  height_change_cm?: number;
  total_records: number;
}

export interface FeedingRecord {
  id: string;
  child_id: string;
  feeding_type: 'breastfeeding' | 'formula' | 'expressed_milk';
  start_time: string;
  end_time?: string;
  amount_ml?: number;
  left_duration_min?: number;
  right_duration_min?: number;
  notes?: string;
  created_at: string;
}

export interface FeedingDailySummary {
  date: string;
  total_amount_ml: number;
  total_breastfeeding_min: number;
  formula_count: number;
  breastfeeding_count: number;
  expressed_milk_count: number;
  total_count: number;
}

export interface SleepRecord {
  id: string;
  child_id: string;
  start_time: string;
  end_time?: string;
  duration_min?: number;
  is_nap: boolean;
  is_ongoing: boolean;
  notes?: string;
  created_at: string;
}

export interface SleepDailySummary {
  date: string;
  total_sleep_min: number;
  night_sleep_min: number;
  nap_sleep_min: number;
  nap_count: number;
  night_count: number;
  ongoing_sleep?: SleepRecord;
}

export interface HealthEvent {
  id: string;
  child_id: string;
  rule_id?: string;
  event_type: 'vaccine' | 'checkup' | 'hospital';
  title: string;
  scheduled_date: string;
  completed_date?: string;
  status: 'scheduled' | 'completed' | 'overdue';
  is_self_reported: boolean;
  facility_name?: string;
  notes?: string;
  created_at: string;
}

export interface HealthCalendarSummary {
  upcoming_events: HealthEvent[];
  overdue_events: HealthEvent[];
  completed_count: number;
  total_count: number;
}

export interface ContentArticle {
  id: string;
  title: string;
  category: string;
  age_months_min: number;
  age_months_max: number;
  summary: string;
  content_body: string;
  is_approved: boolean;
  review_status: string;
  version: number;
  source?: {
    id: string;
    name: string;
    organization: string;
    url?: string;
    license: string;
  };
  created_at: string;
  updated_at: string;
}

export interface SourceCitation {
  title: string;
  organization: string;
  url?: string;
  category: string;
  excerpt?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  is_emergency?: boolean;
  created_at: string;
}

export interface AIChatResponse {
  conversation_id: string;
  message_id: string;
  reply: string;
  sources: SourceCitation[];
  is_emergency: boolean;
  safety_disclaimer: string;
  suggested_follow_ups: string[];
  used_child_context: boolean;
}
