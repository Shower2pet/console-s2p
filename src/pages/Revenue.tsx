import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Euro, TrendingUp, Loader2, Monitor, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { useTransactions } from "@/hooks/useTransactions";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchPartnerProfiles } from "@/services/profileService";
import { fetchAllStructuresLight } from "@/services/structureService";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, format, startOfDay, isAfter } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";

type PeriodKey = "3m" | "6m" | "1y" | "all";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1A" },
  { key: "all", label: "Tutto" },
];

const Revenue = () => {
  const { data: transactions, isLoading } = useTransactions();
  const { data: stations } = useStations();
  const [period, setPeriod] = useState<PeriodKey>("6m");

  const { data: profiles } = useQuery({
    queryKey: ["revenue-profiles"],
    queryFn: fetchPartnerProfiles,
  });

  const { data: structures } = useQuery({
    queryKey: ["revenue-structures"],
    queryFn: fetchAllStructuresLight,
  });

  // Filter transactions by period
  const periodStart = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "3m": return subMonths(now, 3);
      case "6m": return subMonths(now, 6);
      case "1y": return subMonths(now, 12);
      default: return null;
    }
  }, [period]);

  const filteredTransactions = useMemo(() => {
    if (!periodStart) return transactions ?? [];
    return (transactions ?? []).filter(t =>
      t.created_at && isAfter(new Date(t.created_at), periodStart)
    );
  }, [transactions, periodStart]);

  // Chart data: aggregate by day
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
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
  }, [filteredTransactions]);

  const totalRevenue = filteredTransactions.reduce((s, t) => s + Number(t.total_value ?? 0), 0);

  // Most profitable stations
  const stationRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.station_id) map[t.station_id] = (map[t.station_id] ?? 0) + Number(t.total_value ?? 0);
    });
    return Object.entries(map)
      .map(([stationId, revenue]) => ({ stationId, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions]);

  // Most profitable clients (by structure owner)
  const clientRevenue = useMemo(() => {
    const structOwnerMap: Record<string, string> = {};
    (structures ?? []).forEach(s => { if (s.owner_id) structOwnerMap[s.id] = s.owner_id; });

    const map: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      if (t.structure_id) {
        const ownerId = structOwnerMap[t.structure_id];
        if (ownerId) map[ownerId] = (map[ownerId] ?? 0) + Number(t.total_value ?? 0);
      }
    });

    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach(p => { profileMap[p.id] = p; });

    return Object.entries(map)
      .map(([ownerId, revenue]) => ({
        ownerId,
        revenue,
        name: profileMap[ownerId] ? profileMap[ownerId].legal_name || [profileMap[ownerId].first_name, profileMap[ownerId].last_name].filter(Boolean).join(" ") || profileMap[ownerId].email : ownerId,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, structures, profiles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Euro className="inline mr-2 h-6 w-6 text-primary" />
          Ricavi
        </h1>
        <p className="text-muted-foreground">Panoramica delle performance economiche</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Ricavi Periodo" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" />
        <StatCard title="Transazioni Periodo" value={filteredTransactions.length} icon={TrendingUp} variant="success" />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
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
            <ResponsiveContainer width="100%" height={320}>
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
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Nessun dato nel periodo selezionato
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top stations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" /> Stazioni più Profittevoli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Stazione</TableHead>
                  <TableHead className="text-right">Incasso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stationRevenue.slice(0, 10).map((s, i) => (
                  <TableRow key={s.stationId} className="cursor-pointer hover:bg-accent/50">
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {(() => {
                        const st = (stations ?? []).find(x => x.id === s.stationId);
                        const structId = st?.structure_id;
                        return structId ? (
                          <Link to={`/structures/${structId}`} className="text-foreground hover:text-primary font-medium transition-colors flex items-center gap-1">
                            {s.stationId} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-foreground font-medium">{s.stationId}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">€{s.revenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                {stationRevenue.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nessun dato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Partner più Profittevoli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Incasso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRevenue.slice(0, 10).map((c, i) => (
                  <TableRow key={c.ownerId} className="cursor-pointer hover:bg-accent/50">
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link to={`/clients/${c.ownerId}`} className="text-foreground hover:text-primary font-medium transition-colors flex items-center gap-1">
                        {c.name} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">€{c.revenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                {clientRevenue.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nessun dato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Revenue;
