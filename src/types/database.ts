/**
 * Strict application-level types derived from the Supabase schema.
 * Use these instead of raw `string` for status fields shared with S2P User.
 *
 * The auto-generated file `src/integrations/supabase/types.ts` is read-only;
 * this module adds narrower unions and convenience aliases on top of it.
 */

import type { Tables, Enums } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ */
/*  Enums already defined in Supabase – re-export for convenience     */
/* ------------------------------------------------------------------ */

export type StationStatus = Enums<"station_status">; // "AVAILABLE" | "BUSY" | "OFFLINE" | "MAINTENANCE"
export type VisibilityType = Enums<"visibility_type">; // "PUBLIC" | "RESTRICTED" | "HIDDEN"
export type PaymentMethodType = Enums<"payment_method_type">; // "STRIPE" | "CREDITS" | "HYBRID"
export type TransactionTypeEnum = Enums<"transaction_type_enum">; // "CREDIT_TOPUP" | "WASH_SERVICE" | "GUEST_WASH"
export type UserRole = Enums<"user_role">; // "admin" | "partner" | "manager" | "user"

/* ------------------------------------------------------------------ */
/*  Status unions NOT captured by Supabase enums (stored as `text`)   */
/* ------------------------------------------------------------------ */

/** transaction_receipts.status */
export type ReceiptStatus = "PENDING" | "SENT" | "ERROR";

/** wash_sessions.status */
export type WashSessionStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";

/** wash_sessions.step */
export type WashSessionStep = "timer" | "feedback" | "done";

/** transactions.status */
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

/** transactions.fiscal_status */
export type FiscalStatus = "TO_SEND" | "SENT" | "ERROR";

/** maintenance_logs.status */
export type MaintenanceStatus = "open" | "in_progress" | "risolto";

/** maintenance_logs.severity */
export type MaintenanceSeverity = "low" | "medium" | "high";

/** daily_corrispettivi_logs.status */
export type CorrispettivoStatus = "PENDING" | "SENT" | "ERROR";

/* ------------------------------------------------------------------ */
/*  Row-level type aliases (from auto-generated Supabase types)       */
/* ------------------------------------------------------------------ */

export type Profile = Tables<"profiles">;
export type Station = Tables<"stations">;
export type Structure = Tables<"structures">;
export type Transaction = Tables<"transactions">;
export type TransactionReceipt = Tables<"transaction_receipts">;
export type WashSession = Tables<"wash_sessions">;
export type MaintenanceLog = Tables<"maintenance_logs">;
export type CreditPackage = Tables<"credit_packages">;
export type Product = Tables<"products">;
export type SubscriptionPlan = Tables<"subscription_plans">;
export type UserSubscription = Tables<"user_subscriptions">;
export type StructureManager = Tables<"structure_managers">;
export type StructureWallet = Tables<"structure_wallets">;
export type PartnerFiscalData = Tables<"partners_fiscal_data">;
export type DailyCorrispettivoLog = Tables<"daily_corrispettivi_logs">;
export type GateCommand = Tables<"gate_commands">;
export type StationAccessLog = Tables<"station_access_logs">;
