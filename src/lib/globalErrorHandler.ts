import { logErrorToDb } from "@/services/errorLogService";
import { toast } from "sonner";

const USER_FRIENDLY_MESSAGE = "Si è verificato un errore. Riprova più tardi.";

/**
 * Masks technical errors and shows a user-friendly toast.
 * Logs the real error to the DB.
 */
export const handleAppError = (
  error: unknown,
  context?: string,
  options?: { silent?: boolean }
) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Log to DB
  logErrorToDb({
    error_message: message,
    error_stack: stack,
    error_context: context,
    severity: "error",
  });

  // Show friendly toast unless silent
  if (!options?.silent) {
    toast.error(USER_FRIENDLY_MESSAGE);
  }

  // Still log to console in dev
  if (import.meta.env.DEV) {
    console.error(`[AppError] ${context ?? ""}:`, error);
  }
};

/**
 * Install global listeners for unhandled errors and rejections
 */
export const installGlobalErrorHandlers = () => {
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    const error = event.reason;
    logErrorToDb({
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      error_context: "unhandledrejection",
      severity: "critical",
    });
    // Don't show toast for unhandled rejections to avoid noise
  });

  window.addEventListener("error", (event) => {
    logErrorToDb({
      error_message: event.message,
      error_stack: `${event.filename}:${event.lineno}:${event.colno}`,
      error_context: "window.onerror",
      severity: "critical",
    });
  });
};
