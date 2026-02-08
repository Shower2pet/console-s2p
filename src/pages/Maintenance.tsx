import { Wrench, AlertTriangle, AlertCircle, Info, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maintenanceLogs, stations } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const levelConfig = {
  error: { icon: AlertCircle, className: 'text-destructive bg-destructive/10', label: 'Errore' },
  warning: { icon: AlertTriangle, className: 'text-warning-foreground bg-warning/20', label: 'Avviso' },
  info: { icon: Info, className: 'text-primary bg-primary/10', label: 'Info' },
};

const Maintenance = () => {
  const offlineStations = stations.filter(s => s.status === 'offline' || s.status === 'maintenance');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Wrench className="inline mr-2 h-6 w-6 text-primary" />
          Manutenzione & Log
        </h1>
        <p className="text-muted-foreground">Monitoraggio eventi e alert di sistema</p>
      </div>

      {/* Offline/Maintenance stations */}
      {offlineStations.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Stazioni Non Operative ({offlineStations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offlineStations.map(s => (
                <Link key={s.id} to={`/stations/${s.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.clientName}</p>
                        </div>
                      </div>
                      <StatusBadge status={s.status} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Log di Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {maintenanceLogs.map(log => {
            const config = levelConfig[log.level];
            const LevelIcon = config.icon;
            return (
              <div key={log.id} className="flex items-start gap-4 rounded-lg p-3 hover:bg-accent/50 transition-colors border">
                <div className={cn("rounded-lg p-2 flex-shrink-0", config.className)}>
                  <LevelIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{log.message}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <Link to={`/stations/${log.stationId}`} className="text-xs text-primary hover:underline font-medium">
                      {log.stationName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                  </div>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0",
                  log.level === 'error' && 'bg-destructive/20 text-destructive',
                  log.level === 'warning' && 'bg-warning/20 text-warning-foreground',
                  log.level === 'info' && 'bg-primary/10 text-primary',
                )}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default Maintenance;
