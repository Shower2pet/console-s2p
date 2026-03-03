import { Euro, Monitor, Users, TrendingUp, ArrowRight, Loader2, Droplets, MapPin } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useTransactionsByDate } from "@/hooks/useTransactions";
import { useStations } from "@/hooks/useStations";
import { useStructures } from "@/hooks/useStructures";
import { format } from "date-fns";
import StationsMap from "@/components/StationsMap";
import RevenueChart from "@/components/RevenueChart";

const AdminHome = () => {
  const { chartData, transactions, isLoading: txLoading } = useTransactionsByDate();
  const { data: stations, isLoading: stLoading } = useStations();
  const { data: structures } = useStructures();

  const totalRevenue = (transactions ?? []).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const activeStations = (stations ?? []).filter(s => s.status === "AVAILABLE" || s.status === "BUSY").length;
  const totalPartners = new Set((structures ?? []).map(s => s.owner_id).filter(Boolean)).size;

  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = (transactions ?? []).filter(t => t.created_at?.startsWith(today)).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const todayWashes = (transactions ?? []).filter(t => t.created_at?.startsWith(today) && (t.transaction_type === "WASH_SERVICE" || t.transaction_type === "GUEST_WASH")).length;

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
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground">Panoramica globale Shower2Pet</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard title="Incasso Totale" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" href="/revenue" />
        <StatCard title="Stazioni Attive" value={activeStations} icon={Monitor} variant="success" href="/stations" />
        <StatCard title="Partner Totali" value={totalPartners} icon={Users} variant="default" href="/clients" />
        <StatCard title="Incasso Oggi" value={`€${todayRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="warning" href="/revenue" />
        <StatCard title="Lavaggi Oggi" value={todayWashes} icon={Droplets} variant="primary" href="/revenue" />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <RevenueChart transactions={transactions ?? []} height={240} className="lg:col-span-2 animate-fade-in" />

        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-heading">Strutture</CardTitle>
              <Link to="/structures" className="text-xs text-primary hover:underline flex items-center gap-1">
                Vedi tutte <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(structures ?? []).slice(0, 5).map((s) => (
              <Link key={s.id} to={`/structures/${s.id}`} className="flex items-center justify-between rounded-lg p-2 hover:bg-accent/50 transition-colors">
                <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
            {(structures ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nessuna struttura trovata</p>}
          </CardContent>
        </Card>
      </div>

      {mapPins.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Mappa Stazioni
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
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
            <StationsMap stations={mapPins} height="300px" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminHome;
