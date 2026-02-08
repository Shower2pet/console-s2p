import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Power, Droplets, Euro, Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { stations, stationLogs, revenueData } from "@/lib/mock-data";
import { useState } from "react";
import { cn } from "@/lib/utils";

const StationDashboard = () => {
  const { id } = useParams();
  const station = stations.find(s => s.id === id);
  const [isActive, setIsActive] = useState(station?.isActive ?? false);

  if (!station) return <div className="p-6 text-muted-foreground">Stazione non trovata.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/stations" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">{station.name}</h1>
          <p className="text-muted-foreground">{station.location} • {station.clientName}</p>
        </div>
        <StatusBadge status={station.status} />
      </div>

      {/* Power switch */}
      <Card className={cn("border-2 transition-colors", isActive ? "border-success/40 bg-success/5" : "border-destructive/20 bg-destructive/5")}>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className={cn("rounded-xl p-3", isActive ? "bg-success/20" : "bg-destructive/10")}>
              <Power className={cn("h-6 w-6", isActive ? "text-success-foreground" : "text-destructive")} />
            </div>
            <div>
              <p className="text-lg font-heading font-bold text-foreground">Alimentazione Stazione</p>
              <p className="text-sm text-muted-foreground">{isActive ? 'La stazione è operativa' : 'La stazione è spenta'}</p>
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Giornaliero" value={`€${station.dailyRevenue}`} icon={Euro} variant="primary" />
        <StatCard title="Lavaggi Totali" value={station.totalWashes} icon={Droplets} variant="success" />
        <StatCard title="Tipo" value={station.type.charAt(0).toUpperCase() + station.type.slice(1)} icon={Activity} variant="default" />
        <StatCard title="Uptime" value="98.5%" icon={Clock} variant="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart title={`Ricavi - ${station.name}`} />
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Log Attività</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[340px] overflow-y-auto">
            {stationLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent/50 transition-colors">
                <span className={cn(
                  "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                  log.type === 'success' && 'bg-success',
                  log.type === 'warning' && 'bg-warning',
                  log.type === 'info' && 'bg-secondary',
                )} />
                <div>
                  <p className="text-sm text-foreground">{log.event}</p>
                  <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StationDashboard;
