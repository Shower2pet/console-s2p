import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Euro, TrendingUp, Loader2, Monitor, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { useTransactions } from "@/hooks/useTransactions";
import { useStations } from "@/hooks/useStations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Revenue = () => {
  const { data: transactions, isLoading } = useTransactions();
  const { data: stations } = useStations();

  const { data: profiles } = useQuery({
    queryKey: ["revenue-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "partner");
      if (error) throw error;
      return data;
    },
  });

  const { data: structures } = useQuery({
    queryKey: ["revenue-structures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("structures").select("id, name, owner_id");
      if (error) throw error;
      return data;
    },
  });

  // Most profitable stations
  const stationRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    (transactions ?? []).forEach(t => {
      if (t.station_id) map[t.station_id] = (map[t.station_id] ?? 0) + Number(t.total_value ?? 0);
    });
    return Object.entries(map)
      .map(([stationId, revenue]) => ({ stationId, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactions]);

  // Most profitable clients (by structure owner)
  const clientRevenue = useMemo(() => {
    const structOwnerMap: Record<string, string> = {};
    (structures ?? []).forEach(s => { if (s.owner_id) structOwnerMap[s.id] = s.owner_id; });

    const map: Record<string, number> = {};
    (transactions ?? []).forEach(t => {
      if (t.structure_id) {
        const ownerId = structOwnerMap[t.structure_id];
        if (ownerId) map[ownerId] = (map[ownerId] ?? 0) + Number(t.total_value ?? 0);
      }
    });

    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach(p => { profileMap[p.id] = p; });

    return Object.entries(map)
      .map(([ownerId, revenue]) => ({
        ownerId,
        revenue,
        name: profileMap[ownerId] ? [profileMap[ownerId].first_name, profileMap[ownerId].last_name].filter(Boolean).join(" ") || profileMap[ownerId].email : ownerId,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactions, structures, profiles]);

  const totalRevenue = (transactions ?? []).reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const totalStripe = (transactions ?? []).reduce((s, t) => s + Number(t.amount_paid_stripe ?? 0), 0);
  const totalWallet = (transactions ?? []).reduce((s, t) => s + Number(t.amount_paid_wallet ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Euro className="inline mr-2 h-6 w-6 text-primary" />
          Resoconto Incassi
        </h1>
        <p className="text-muted-foreground">Panoramica delle performance economiche</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Incasso Totale" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" />
        <StatCard title="Incasso Carta" value={`€${totalStripe.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="success" />
        <StatCard title="Incasso Crediti" value={`€${totalWallet.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top stations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" /> Stazioni più Profittevoli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Stazione</TableHead>
                  <TableHead className="text-right">Incasso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stationRevenue.slice(0, 10).map((s, i) => (
                  <TableRow key={s.stationId} className="cursor-pointer hover:bg-accent/50">
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {(() => {
                        const st = (stations ?? []).find(x => x.id === s.stationId);
                        const structId = st?.structure_id;
                        return structId ? (
                          <Link to={`/structures/${structId}`} className="text-foreground hover:text-primary font-medium transition-colors flex items-center gap-1">
                            {s.stationId} <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-foreground font-medium">{s.stationId}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">€{s.revenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                {stationRevenue.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nessun dato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Partner più Profittevoli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Incasso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRevenue.slice(0, 10).map((c, i) => (
                  <TableRow key={c.ownerId} className="cursor-pointer hover:bg-accent/50">
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link to={`/clients/${c.ownerId}`} className="text-foreground hover:text-primary font-medium transition-colors flex items-center gap-1">
                        {c.name} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">€{c.revenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                {clientRevenue.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nessun dato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Revenue;
