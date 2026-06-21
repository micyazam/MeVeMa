import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// אם המשתנים חסרים — ניצור לקוח דמה כדי שהאתר לא יקרוס לפני ההגדרה
export const supabase = isConfigured
  ? createClient(url, key)
  : null;
