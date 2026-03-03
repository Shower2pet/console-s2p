import { useState, useMemo } from "react";
import { TrendingUp, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, format, isAfter, isBefore, eachDayOfInterval, startOfDay, setYear } from "date-fns";
import { it } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type PeriodKey = "3m" | "6m" | "1y" | "all" | "custom";
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
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const handlePeriodClick = (key: PeriodKey) => {
    setPeriod(key);
    if (key !== "custom") {
      setCustomRange({});
    }
  };

  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    if (period === "custom" && customRange.from && customRange.to) {
      return { rangeStart: startOfDay(customRange.from), rangeEnd: startOfDay(customRange.to) };
    }
    switch (period) {
      case "3m": return { rangeStart: subMonths(now, 3), rangeEnd: null };
      case "6m": return { rangeStart: subMonths(now, 6), rangeEnd: null };
      case "1y": return { rangeStart: subMonths(now, 12), rangeEnd: null };
      default: return { rangeStart: null, rangeEnd: null };
    }
  }, [period, customRange]);

  const chartData = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (!t.created_at) return false;
      const d = new Date(t.created_at);
      if (rangeStart && !isAfter(d, rangeStart)) return false;
      if (rangeEnd && isBefore(d, rangeEnd) === false && startOfDay(d) > startOfDay(rangeEnd)) return false;
      return true;
    });

    const map: Record<string, number> = {};
    filtered.forEach(t => {
      if (!t.created_at) return;
      const day = format(startOfDay(new Date(t.created_at)), "yyyy-MM-dd");
      map[day] = (map[day] ?? 0) + Number(t.total_value ?? 0);
    });

    const now = new Date();
    const start = rangeStart ?? (filtered.length > 0
      ? new Date(filtered.reduce((min, t) => t.created_at && t.created_at < min ? t.created_at : min, filtered[0]?.created_at ?? now.toISOString()))
      : subMonths(now, 1));
    const end = rangeEnd ?? now;

    const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });

    return days.map(day => {
      const key = format(day, "yyyy-MM-dd");
      return {
        date: key,
        label: format(day, "d MMM", { locale: it }),
        ricavi: Number((map[key] ?? 0).toFixed(2)),
      };
    });
  }, [transactions, rangeStart, rangeEnd]);

  const totalPeriod = chartData.reduce((s, d) => s + d.ricavi, 0);

  const customLabel = customRange.from && customRange.to
    ? `${format(customRange.from, "dd/MM/yy")} – ${format(customRange.to, "dd/MM/yy")}`
    : "Personalizzato";

  const activeRange = calendarOpen ? draftRange : customRange;

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
                onClick={() => handlePeriodClick(p.key)}
              >
                {p.label}
              </Button>
            ))}
            <Popover
              open={calendarOpen}
              onOpenChange={(open) => {
                setCalendarOpen(open);
                if (open) {
                  setDraftRange({});
                  setCalendarMonth(customRange.from ?? new Date());
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={period === "custom" ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 px-2.5 text-xs font-medium gap-1 ${period === "custom" ? "" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {period === "custom" ? customLabel : "Periodo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex items-center justify-center gap-2 px-3 pt-3 pb-1">
                  <span className="text-sm text-muted-foreground">Anno:</span>
                  <Select
                    value={String(calendarMonth.getFullYear())}
                    onValueChange={(val) => {
                      setCalendarMonth(setYear(calendarMonth, Number(val)));
                    }}
                  >
                    <SelectTrigger className="h-8 w-[90px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="pointer-events-auto">
                      {Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="range"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={activeRange.from ? { from: activeRange.from, to: activeRange.to } : undefined}
                  onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                    const nextRange = range ?? {};
                    setDraftRange(nextRange);

                    if (nextRange.from && nextRange.to) {
                      setCustomRange(nextRange);
                      setPeriod("custom");
                      setTimeout(() => setCalendarOpen(false), 150);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                  locale={it}
                />
              </PopoverContent>
            </Popover>
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
