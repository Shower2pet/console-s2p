import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Euro, Monitor, TrendingUp, Mail, Phone, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { StatusBadge } from "@/components/StatusBadge";
import { clients, stations } from "@/lib/mock-data";

const ClientDetail = () => {
  const { id } = useParams();
  const client = clients.find(c => c.id === id);
  const clientStations = stations.filter(s => s.clientId === id);

  if (!client) return <div className="p-6 text-muted-foreground">Cliente non trovato.</div>;

  const activeStations = clientStations.filter(s => s.status === 'online').length;
  const dailyTotal = clientStations.reduce((sum, s) => sum + s.dailyRevenue, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/clients" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-foreground">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {client.email}</span>
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Dal {client.joinDate}</span>
          </div>
        </div>
        <StatusBadge status={client.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Totale" value={`€${client.totalRevenue.toLocaleString()}`} icon={Euro} variant="primary" />
        <StatCard title="Stazioni Attive" value={`${activeStations}/${clientStations.length}`} icon={Monitor} variant="success" />
        <StatCard title="Ricavo/Giorno" value={`€${dailyTotal}`} icon={TrendingUp} variant="warning" />
        <StatCard title="Lavaggi Totali" value={clientStations.reduce((sum, s) => sum + s.totalWashes, 0).toLocaleString()} icon={TrendingUp} variant="default" />
      </div>

      <RevenueChart title={`Ricavi - ${client.name}`} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Stazioni del Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {clientStations.map(s => (
              <Link key={s.id} to={`/stations/${s.id}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.location}</p>
                      <span className="mt-1 capitalize inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.type}</span>
                    </div>
                    <div className="text-right space-y-1">
                      <StatusBadge status={s.status} />
                      <p className="text-sm font-bold text-foreground">€{s.dailyRevenue}/g</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDetail;
