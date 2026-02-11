import { Euro, Monitor, TrendingUp, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ClientHome = () => {
  const { profile } = useAuth();
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Partner";

  // TODO Phase 2: Replace with real Supabase data
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Benvenuto, {displayName} 👋</h1>
        <p className="text-muted-foreground">La tua panoramica personale</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Mensile" value="—" icon={Euro} variant="primary" />
        <StatCard title="Stazioni Attive" value="—" icon={Monitor} variant="success" />
        <StatCard title="Ricavo/Giorno" value="—" icon={TrendingUp} variant="warning" />
        <StatCard title="Lavaggi Mese" value="—" icon={TrendingUp} variant="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart type="line" title="Andamento Lavaggi" />
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-heading">Le Mie Strutture</CardTitle>
              <Link to="/structures" className="text-xs text-primary hover:underline flex items-center gap-1">
                Vedi tutte <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Dati reali in arrivo nella Fase 2</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientHome;
