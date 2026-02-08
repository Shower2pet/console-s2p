import { Euro, Monitor, Users, TrendingUp, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clients, stations } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

const AdminHome = () => {
  const totalRevenue = clients.reduce((sum, c) => sum + c.totalRevenue, 0);
  const activeStations = stations.filter(s => s.status === 'online').length;
  const topClients = [...clients].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Panoramica globale Shower2Pet</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incasso Totale" value={`€${totalRevenue.toLocaleString()}`} icon={Euro} variant="primary" trend={{ value: 12.5, positive: true }} />
        <StatCard title="Stazioni Attive" value={`${activeStations}/${stations.length}`} icon={Monitor} variant="success" />
        <StatCard title="Clienti Totali" value={clients.length} icon={Users} variant="default" />
        <StatCard title="Media Giornaliera" value="€1.243" icon={TrendingUp} variant="warning" trend={{ value: 8.2, positive: true }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-heading">Top Clienti</CardTitle>
              <Link to="/clients" className="text-xs text-primary hover:underline flex items-center gap-1">
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topClients.map((client, i) => (
              <Link key={client.id} to={`/clients/${client.id}`} className="flex items-center justify-between rounded-lg p-3 hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.stations} stazioni</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">€{client.totalRevenue.toLocaleString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent stations activity */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading">Stato Stazioni</CardTitle>
            <Link to="/stations" className="text-xs text-primary hover:underline flex items-center gap-1">
              Vedi tutte <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Stazione</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Stato</th>
                  <th className="pb-3 font-medium text-right">Ricavo/giorno</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stations.slice(0, 6).map(s => (
                  <tr key={s.id} className="hover:bg-accent/50 transition-colors">
                    <td className="py-3">
                      <Link to={`/stations/${s.id}`} className="font-medium text-foreground hover:text-primary">{s.name}</Link>
                    </td>
                    <td className="py-3 text-muted-foreground">{s.clientName}</td>
                    <td className="py-3"><span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.type}</span></td>
                    <td className="py-3"><StatusBadge status={s.status} /></td>
                    <td className="py-3 text-right font-medium text-foreground">€{s.dailyRevenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHome;
