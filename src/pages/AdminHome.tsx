import { Euro, Monitor, Users, TrendingUp, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const AdminHome = () => {
  // TODO Phase 2: Replace with real Supabase data
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Panoramica globale Shower2Pet</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incasso Totale" value="—" icon={Euro} variant="primary" />
        <StatCard title="Stazioni Attive" value="—" icon={Monitor} variant="success" />
        <StatCard title="Partner Totali" value="—" icon={Users} variant="default" />
        <StatCard title="Media Giornaliera" value="—" icon={TrendingUp} variant="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-heading">Strutture</CardTitle>
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

export default AdminHome;
