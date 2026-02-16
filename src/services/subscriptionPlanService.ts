import { supabase } from "@/integrations/supabase/client";

export const fetchSubscriptionPlans = async (ownerId: string) => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const createSubscriptionPlan = async (plan: {
  owner_id: string;
  name: string;
  price_eur: number;
  interval: string;
  max_washes_per_month?: number | null;
}) => {
  const { error } = await supabase.from("subscription_plans").insert(plan);
  if (error) throw error;
};

export const deactivateSubscriptionPlan = async (planId: string) => {
  const { error } = await supabase.from("subscription_plans").update({ is_active: false }).eq("id", planId);
  if (error) throw error;
};
