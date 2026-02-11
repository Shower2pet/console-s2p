import { useState, useMemo } from "react";
import { Download, Euro, TrendingUp, FileSpreadsheet, Loader2, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Financials = () => {
  const { role, structureIds } = useAuth();
  const structureId = role === "manager" && structureIds.length === 1 ? structureIds[0] : undefined;
  const { data: transactions, isLoading } = useTransactions(structureId);
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() =>
    (transactions ?? []).filter(t => typeFilter === "all" || t.transaction_type === typeFilter),
    [transactions, typeFilter]
  );

  const totalRevenue = filtered.reduce((s, t) => s + Number(t.total_value ?? 0), 0);
  const totalStripe = filtered.reduce((s, t) => s + Number(t.amount_paid_stripe ?? 0), 0);
  const totalWallet = filtered.reduce((s, t) => s + Number(t.amount_paid_wallet ?? 0), 0);
  const totalWashes = filtered.filter(t => t.transaction_type === "WASH_SERVICE" || t.transaction_type === "GUEST_WASH").length;

  // Chart data grouped by day
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(t => {
      const day = t.created_at?.slice(0, 10) ?? "unknown";
      map[day] = (map[day] ?? 0) + Number(t.total_value ?? 0);
    });
    return Object.entries(map).sort().map(([date, revenue]) => ({ date, revenue }));
  }, [filtered]);

  const exportCSV = () => {
    const header = "Data,Tipo,Valore,Carta,Crediti,Stato\n";
    const rows = filtered.map(t =>
      `${t.created_at?.slice(0, 10)},${t.transaction_type},${t.total_value},${t.amount_paid_stripe ?? 0},${t.amount_paid_wallet ?? 0},${t.status}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_finanziario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            <Euro className="inline mr-2 h-6 w-6 text-primary" />
            Finanze
          </h1>
          <p className="text-muted-foreground">{filtered.length} transazioni</p>
        </div>
        <Button onClick={exportCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Totale" value={`€${totalRevenue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="primary" />
        <StatCard title="Incasso Carta" value={`€${totalStripe.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={Euro} variant="success" />
        <StatCard title="Incasso Crediti" value={`€${totalWallet.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`} icon={TrendingUp} variant="warning" />
        <StatCard title="Lavaggi" value={totalWashes} icon={TrendingUp} variant="default" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-heading">Ricavi per Giorno</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(207, 20%, 46%)" tickFormatter={(v) => { try { return format(new Date(v), "dd MMM", { locale: it }); } catch { return v; } }} />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(0,0%,100%)", border: "1px solid hsl(210,20%,90%)", borderRadius: "0.75rem", fontFamily: "Outfit" }} formatter={(value: number) => [`€${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`, "Ricavi"]} />
              <Bar dataKey="revenue" fill="hsl(207, 100%, 29%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg font-heading">Dettaglio Transazioni</CardTitle>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="WASH_SERVICE">Lavaggio Utente</SelectItem>
                  <SelectItem value="GUEST_WASH">Lavaggio Guest</SelectItem>
                  <SelectItem value="CREDIT_TOPUP">Ricarica Crediti</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Carta</TableHead>
                <TableHead className="text-right">Crediti</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-foreground">{t.created_at ? format(new Date(t.created_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                  <TableCell className="text-foreground">{t.transaction_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">€{Number(t.total_value).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">€{Number(t.amount_paid_stripe ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">€{Number(t.amount_paid_wallet ?? 0).toFixed(2)}</TableCell>
                  <TableCell><span className="capitalize text-xs">{t.status ?? "—"}</span></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessuna transazione</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Financials;
