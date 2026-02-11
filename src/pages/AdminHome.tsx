import { Euro, Monitor, Users, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useTransactionsByDate } from "@/hooks/useTransactions";
import { useStations } from "@/hooks/useStations";
import { useStructures } from "@/hooks/useStructures";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const AdminHome = () => {
  const { chartData, transactions, isLoading: txLoading } = useTransactionsByDate();
  const { data: stations, isLoading: stLoading } = useStations();
  const { data: structures } = useStructures();

  const totalRevenue = (transactions ?? []).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const activeStations = (stations ?? []).filter(s => s.status === "AVAILABLE" || s.status === "BUSY").length;
  const totalPartners = new Set((structures ?? []).map(s => s.owner_id).filter(Boolean)).size;

  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = (transactions ?? []).filter(t => t.created_at?.startsWith(today)).reduce((s, t) => s + Number(t.total_value ?? 0), 0);

  const last30 = chartData.slice(-30);

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
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Panoramica globale Shower2Pet</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incasso Totale" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" />
        <StatCard title="Stazioni Attive" value={activeStations} icon={Monitor} variant="success" />
        <StatCard title="Partner Totali" value={totalPartners} icon={Users} variant="default" />
        <StatCard title="Incasso Oggi" value={`€${todayRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-heading">Ricavi per Giorno (ultimi 30 gg)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={last30}>
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

        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-heading">Strutture</CardTitle>
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
            {(structures ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nessuna struttura trovata</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHome;
