import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, format, startOfDay, isAfter } from "date-fns";
import { it } from "date-fns/locale";

type PeriodKey = "3m" | "6m" | "1y" | "all";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1A" },
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

const RevenueChart = ({ transactions, height = 320, className }: RevenueChartProps) => {
  const [period, setPeriod] = useState<PeriodKey>("6m");

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

    const map: Record<string, number> = {};
    filtered.forEach(t => {
      if (!t.created_at) return;
      const day = format(startOfDay(new Date(t.created_at)), "yyyy-MM-dd");
      map[day] = (map[day] ?? 0) + Number(t.total_value ?? 0);
    });

    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return sorted.map(([day, value]) => {
      cumulative += value;
      return {
        date: day,
        label: format(new Date(day), "d MMM", { locale: it }),
        ricavi: Number(cumulative.toFixed(2)),
        giornaliero: Number(value.toFixed(2)),
      };
    });
  }, [transactions, periodStart]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Ricavi
          </CardTitle>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map(p => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-xs font-semibold ${period === p.key ? "" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(207, 100%, 29%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(207, 100%, 29%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(207, 20%, 46%)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(207, 20%, 46%)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(210, 20%, 90%)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [
                  `€${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
                  name === "ricavi" ? "Cumulativo" : "Giornaliero",
                ]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="ricavi"
                stroke="hsl(207, 100%, 29%)"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(0, 0%, 100%)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
            Nessun dato nel periodo selezionato
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
