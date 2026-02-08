import { Download, Euro, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/RevenueChart";
import { StatCard } from "@/components/StatCard";
import { revenueData, CURRENT_ROLE } from "@/lib/mock-data";

const RevenueReport = () => {
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalWashes = revenueData.reduce((sum, d) => sum + d.washes, 0);
  const avgPerWash = (totalRevenue / totalWashes).toFixed(2);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Report Ricavi</h1>
          <p className="text-muted-foreground">
            {CURRENT_ROLE === 'ADMIN' ? 'Dati globali di tutte le stazioni' : 'I tuoi dati finanziari'}
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export Agenzia Entrate
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Ricavo Annuale" value={`€${totalRevenue.toLocaleString()}`} icon={Euro} variant="primary" />
        <StatCard title="Lavaggi Totali" value={totalWashes.toLocaleString()} icon={TrendingUp} variant="success" />
        <StatCard title="Media per Lavaggio" value={`€${avgPerWash}`} icon={Euro} variant="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart title="Ricavi Mensili" />
        <RevenueChart type="line" title="Andamento Lavaggi" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Dettaglio Mensile</CardTitle>
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
                    <td className="py-3 text-right text-foreground">€{d.revenue.toLocaleString()}</td>
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

export default RevenueReport;
