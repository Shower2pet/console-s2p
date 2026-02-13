import { useState } from "react";
import { Euro, Monitor, TrendingUp, ArrowRight, Loader2, Droplets, MapPin } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactionsByDate } from "@/hooks/useTransactions";
import { useStations } from "@/hooks/useStations";
import { useStructures } from "@/hooks/useStructures";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import StationsMap from "@/components/StationsMap";

type Period = "today" | "7d" | "month";

const ClientHome = () => {
  const { profile, role, structureIds } = useAuth();
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Partner";
  const [period, setPeriod] = useState<Period>("month");

  const structureId = role === "manager" && structureIds.length === 1 ? structureIds[0] : undefined;
  const { chartData, transactions, isLoading: txLoading } = useTransactionsByDate(structureId);
  const { data: stations, isLoading: stLoading } = useStations(structureId);
  const { data: structures } = useStructures();

  const totalRevenue = (transactions ?? []).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const activeStations = (stations ?? []).filter(s => s.status === "AVAILABLE" || s.status === "BUSY").length;
  const totalStations = (stations ?? []).length;

  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = (transactions ?? []).filter(t => t.created_at?.startsWith(today)).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const todayWashes = (transactions ?? []).filter(t => t.created_at?.startsWith(today) && (t.transaction_type === "WASH_SERVICE" || t.transaction_type === "GUEST_WASH")).length;
  const totalWashes = (transactions ?? []).filter(t => t.transaction_type === "WASH_SERVICE" || t.transaction_type === "GUEST_WASH").length;

  // Chart period filtering
  const now = new Date();
  const periodStart = period === "today" ? today
    : period === "7d" ? subDays(now, 7).toISOString().slice(0, 10)
    : startOfMonth(now).toISOString().slice(0, 10);

  const filteredChart = chartData.filter(d => d.date >= periodStart);

  // Map pins
  const mapPins = (stations ?? []).filter(s => {
    const lat = s.geo_lat ?? (s as any).structures?.geo_lat;
    const lng = s.geo_lng ?? (s as any).structures?.geo_lng;
    return lat && lng;
  }).map(s => ({
    id: s.id,
    lat: Number(s.geo_lat ?? (s as any).structures?.geo_lat),
    lng: Number(s.geo_lng ?? (s as any).structures?.geo_lng),
    status: s.status ?? "OFFLINE",
    name: (s as any).structures?.name,
  }));

  if (txLoading || stLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Benvenuto, {displayName} 👋</h1>
        <p className="text-muted-foreground">{role === "manager" ? "La tua struttura" : "La tua panoramica personale"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Ricavo Totale" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" href="/financials" />
        <StatCard title="Stazioni Attive" value={`${activeStations}/${totalStations}`} icon={Monitor} variant="success" href="/stations" />
        <StatCard title="Incasso Oggi" value={`€${todayRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="warning" href="/financials" />
        <StatCard title="Lavaggi Oggi" value={todayWashes} icon={Droplets} variant="primary" href="/stations" />
        <StatCard title="Lavaggi Totali" value={totalWashes} icon={Droplets} variant="default" href="/stations" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-heading">Ricavi per Giorno</CardTitle>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Oggi</SelectItem>
                  <SelectItem value="7d">Ultimi 7 giorni</SelectItem>
                  <SelectItem value="month">Questo Mese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filteredChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(207, 20%, 46%)"
                  tickFormatter={(v) => {
                    try { return format(new Date(v), "dd MMM", { locale: it }); } catch { return v; }
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(0,0%,100%)", border: "1px solid hsl(210,20%,90%)", borderRadius: "0.75rem", fontFamily: "Outfit" }}
                  formatter={(value: number) => [`€${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`, "Ricavi"]}
                  labelFormatter={(v) => { try { return format(new Date(v), "dd MMMM yyyy", { locale: it }); } catch { return v; } }}
                />
                <Bar dataKey="revenue" fill="hsl(207, 100%, 29%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {role === "partner" && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading">Le Mie Strutture</CardTitle>
                <Link to="/structures" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Vedi tutte <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(structures ?? []).slice(0, 5).map((s) => (
                <Link key={s.id} to={`/structures/${s.id}`} className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/50 transition-colors">
                  <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {role === "manager" && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading">Ultime Transazioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[280px] overflow-y-auto">
              {(transactions ?? []).slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.transaction_type.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? format(new Date(t.created_at), "dd/MM HH:mm") : "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground">€{Number(t.total_value).toFixed(2)}</span>
                </div>
              ))}
              {(transactions ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nessuna transazione</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stations Map */}
      {mapPins.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Mappa Stazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-3 flex-wrap">
              {[
                { label: "Libera", color: "#22c55e" },
                { label: "In uso", color: "#3b82f6" },
                { label: "Manutenzione", color: "#ef4444" },
                { label: "Offline", color: "#6b7280" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
            <StationsMap stations={mapPins} height="350px" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientHome;
