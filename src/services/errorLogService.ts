import { supabase } from "@/integrations/supabase/client";

export interface ErrorLogEntry {
  error_message: string;
  error_stack?: string;
  error_context?: string;
  page_url?: string;
  component?: string;
  severity?: "error" | "warning" | "critical";
}

/**
 * Logs an error to the app_error_logs table silently.
 * Never throws — fire and forget.
 */
export const logErrorToDb = async (entry: ErrorLogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("app_error_logs").insert({
      ...entry,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      page_url: entry.page_url ?? window.location.href,
    });
  } catch {
    // Silently fail — we can't let error logging itself crash the app
    console.error("[ErrorLog] Failed to persist error log");
  }
};

/**
 * Fetch error logs (admin only)
 */
export const fetchErrorLogs = async (limit = 100, onlyUnresolved = false) => {
  let query = (supabase as any)
    .from("app_error_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (onlyUnresolved) {
    query = query.eq("resolved", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as any[];
};

/**
 * Mark an error log as resolved
 */
export const resolveErrorLog = async (id: string) => {
  const { error } = await (supabase as any)
    .from("app_error_logs")
    .update({ resolved: true })
    .eq("id", id);
  if (error) throw error;
};

/**
 * Mark all error logs as resolved
 */
export const resolveAllErrorLogs = async () => {
  const { error } = await (supabase as any)
    .from("app_error_logs")
    .update({ resolved: true })
    .eq("resolved", false);
  if (error) throw error;
};
