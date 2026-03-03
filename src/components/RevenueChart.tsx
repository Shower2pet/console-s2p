import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, subDays, format, isAfter, eachDayOfInterval, startOfDay } from "date-fns";
import { it } from "date-fns/locale";

type PeriodKey = "3m" | "6m" | "1y" | "all";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "3m", label: "3 mesi" },
  { key: "6m", label: "6 mesi" },
  { key: "1y", label: "1 anno" },
  { key: "all", label: "Tutto" },
];

interface Transaction {
  created_at?: string | null;
  total_value: number;
}

interface RevenueChartProps {
  transactions: Transaction[];
  height?: number;
  className?: string;
}

const RevenueChart = ({ transactions, height = 300, className }: RevenueChartProps) => {
  const [period, setPeriod] = useState<PeriodKey>("3m");

  const periodStart = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "3m": return subMonths(now, 3);
      case "6m": return subMonths(now, 6);
      case "1y": return subMonths(now, 12);
      default: return null;
    }
  }, [period]);

  const chartData = useMemo(() => {
    const filtered = periodStart
      ? transactions.filter(t => t.created_at && isAfter(new Date(t.created_at), periodStart))
      : transactions;

    // Aggregate by day
    const map: Record<string, number> = {};
    filtered.forEach(t => {
      if (!t.created_at) return;
      const day = format(startOfDay(new Date(t.created_at)), "yyyy-MM-dd");
      map[day] = (map[day] ?? 0) + Number(t.total_value ?? 0);
    });

    // Fill empty days so chart isn't just one bar
    const now = new Date();
    const start = periodStart ?? (filtered.length > 0
      ? new Date(filtered.reduce((min, t) => t.created_at && t.created_at < min ? t.created_at : min, filtered[0]?.created_at ?? now.toISOString()))
      : subMonths(now, 1));

    const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(now) });

    return days.map(day => {
      const key = format(day, "yyyy-MM-dd");
      return {
        date: key,
        label: format(day, "d MMM", { locale: it }),
        ricavi: Number((map[key] ?? 0).toFixed(2)),
      };
    });
  }, [transactions, periodStart]);

  const totalPeriod = chartData.reduce((s, d) => s + d.ricavi, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Ricavi
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Totale periodo: <span className="font-semibold text-foreground">€{totalPeriod.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map(p => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 text-xs font-medium ${period === p.key ? "" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(207, 100%, 29%)" />
                <stop offset="100%" stopColor="hsl(207, 100%, 45%)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 92%)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(207, 20%, 46%)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(207, 20%, 46%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              width={50}
            />
            <Tooltip
              cursor={{ fill: "hsl(207, 100%, 29%)", opacity: 0.06 }}
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(210, 20%, 90%)",
                borderRadius: "8px",
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number) => [
                `€${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
                "Ricavi",
              ]}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="ricavi"
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
