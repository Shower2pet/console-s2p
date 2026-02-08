import { Euro, Monitor, TrendingUp, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stations } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ClientHome = () => {
  const { user } = useAuth();
  const myStations = stations.filter(s => s.clientId === user?.clientId);
  const myRevenue = myStations.reduce((sum, s) => sum + s.dailyRevenue * 30, 0);
  const activeCount = myStations.filter(s => s.status === 'online').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Benvenuto, {user?.name} 👋</h1>
        <p className="text-muted-foreground">La tua panoramica personale</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Mensile" value={`€${myRevenue.toLocaleString()}`} icon={Euro} variant="primary" trend={{ value: 8.3, positive: true }} />
        <StatCard title="Stazioni Attive" value={`${activeCount}/${myStations.length}`} icon={Monitor} variant="success" />
        <StatCard title="Ricavo/Giorno" value={`€${myStations.reduce((s, st) => s + st.dailyRevenue, 0)}`} icon={TrendingUp} variant="warning" trend={{ value: 5.1, positive: true }} />
        <StatCard title="Lavaggi Mese" value="420" icon={TrendingUp} variant="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart type="line" title="Andamento Lavaggi" />
        </div>

        {/* Quick stations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-heading">Le Mie Stazioni</CardTitle>
              <Link to="/stations" className="text-xs text-primary hover:underline flex items-center gap-1">
                Vedi tutte <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {myStations.map(s => (
              <Link key={s.id} to={`/stations/${s.id}`} className="flex items-center justify-between rounded-lg p-3 hover:bg-accent transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.location}</p>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientHome;
