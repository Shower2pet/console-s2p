import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;

export const useTransactions = (structureId?: string) => {
  return useQuery({
    queryKey: ["transactions", structureId],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*");
      if (structureId) query = query.eq("structure_id", structureId);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Transaction[];
    },
  });
};

/** Aggregate transactions by date for chart display */
export const useTransactionsByDate = (structureId?: string) => {
  const { data: transactions, ...rest } = useTransactions(structureId);

  const chartData = (transactions ?? []).reduce<Record<string, { date: string; revenue: number; count: number }>>((acc, t) => {
    const date = t.created_at ? t.created_at.slice(0, 10) : "unknown";
    if (!acc[date]) acc[date] = { date, revenue: 0, count: 0 };
    acc[date].revenue += Number(t.total_value ?? 0);
    acc[date].count += 1;
    return acc;
  }, {});

  const sorted = Object.values(chartData).sort((a, b) => a.date.localeCompare(b.date));

  return { chartData: sorted, transactions, ...rest };
};
