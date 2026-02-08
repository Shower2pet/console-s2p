import { Download, Euro, TrendingUp, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/RevenueChart";
import { StatCard } from "@/components/StatCard";
import { revenueData, stations } from "@/lib/mock-data";
import { useAuth } from "@/contexts/AuthContext";

const Financials = () => {
  const { user } = useAuth();
  const myStations = stations.filter(s => s.clientId === user?.clientId);
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalWashes = revenueData.reduce((sum, d) => sum + d.washes, 0);
  const avgPerWash = (totalRevenue / totalWashes).toFixed(2);
  const monthlyAvg = Math.round(totalRevenue / 12);

  const exportCSV = () => {
    const header = "Mese,Ricavi,Lavaggi,Media/Lavaggio\n";
    const rows = revenueData.map(d =>
      `${d.month},${d.revenue},${d.washes},${(d.revenue / d.washes).toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_finanziario_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            <Euro className="inline mr-2 h-6 w-6 text-primary" />
            Finanze
          </h1>
          <p className="text-muted-foreground">
            Report finanziario — {myStations.length} stazioni
          </p>
        </div>
        <Button onClick={exportCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Export CSV Agenzia Entrate
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Annuale" value={`€${totalRevenue.toLocaleString()}`} icon={Euro} variant="primary" />
        <StatCard title="Media Mensile" value={`€${monthlyAvg.toLocaleString()}`} icon={TrendingUp} variant="success" />
        <StatCard title="Lavaggi Totali" value={totalWashes.toLocaleString()} icon={TrendingUp} variant="warning" />
        <StatCard title="Media/Lavaggio" value={`€${avgPerWash}`} icon={Euro} variant="default" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart title="Ricavi Mensili" />
        <RevenueChart type="line" title="Trend Lavaggi" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading">Dettaglio Mensile</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Mese</th>
                  <th className="pb-3 font-medium text-right">Ricavi</th>
                  <th className="pb-3 font-medium text-right">Lavaggi</th>
                  <th className="pb-3 font-medium text-right">Media/Lavaggio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {revenueData.map(d => (
                  <tr key={d.month} className="hover:bg-accent/50 transition-colors">
                    <td className="py-3 font-medium text-foreground">{d.month}</td>
                    <td className="py-3 text-right text-foreground font-semibold">€{d.revenue.toLocaleString()}</td>
                    <td className="py-3 text-right text-muted-foreground">{d.washes}</td>
                    <td className="py-3 text-right text-muted-foreground">€{(d.revenue / d.washes).toFixed(2)}</td>
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

export default Financials;
