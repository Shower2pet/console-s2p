import { Euro, Monitor, Tag, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stations, discountCodes } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ClientHome = () => {
  const myStations = stations.filter(s => s.clientId === '1');
  const myRevenue = myStations.reduce((sum, s) => sum + s.dailyRevenue * 30, 0);
  const activeCount = myStations.filter(s => s.status === 'online').length;
  const [codes, setCodes] = useState(discountCodes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState<{ code: string; discount: string; type: 'percentage' | 'fixed'; maxUsage: string }>({ code: '', discount: '', type: 'percentage', maxUsage: '' });

  const handleCreateCode = () => {
    if (!newCode.code || !newCode.discount) return;
    setCodes(prev => [...prev, {
      id: `d${Date.now()}`,
      code: newCode.code.toUpperCase(),
      discount: Number(newCode.discount),
      type: newCode.type,
      usageCount: 0,
      maxUsage: Number(newCode.maxUsage) || 100,
      expiresAt: '2026-12-31',
      isActive: true,
    }]);
    setNewCode({ code: '', discount: '', type: 'percentage', maxUsage: '' });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Benvenuto, PetShop Roma 👋</h1>
        <p className="text-muted-foreground">La tua panoramica personale</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ricavo Mensile" value={`€${myRevenue.toLocaleString()}`} icon={Euro} variant="primary" trend={{ value: 8.3, positive: true }} />
        <StatCard title="Stazioni Attive" value={`${activeCount}/${myStations.length}`} icon={Monitor} variant="success" />
        <StatCard title="Codici Sconto" value={codes.filter(c => c.isActive).length} icon={Tag} variant="warning" />
        <StatCard title="Lavaggi Mese" value="420" icon={TrendingUp} variant="default" trend={{ value: 5.1, positive: true }} />
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

      {/* Discount codes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading">Codici Sconto</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Nuovo Codice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">Crea Codice Sconto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Codice</Label>
                    <Input placeholder="ES. ESTATE2026" value={newCode.code} onChange={e => setNewCode(p => ({ ...p, code: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Sconto</Label>
                      <Input type="number" placeholder="10" value={newCode.discount} onChange={e => setNewCode(p => ({ ...p, discount: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={newCode.type} onValueChange={(v: 'percentage' | 'fixed') => setNewCode(p => ({ ...p, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentuale (%)</SelectItem>
                          <SelectItem value="fixed">Fisso (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Utilizzi massimi</Label>
                    <Input type="number" placeholder="100" value={newCode.maxUsage} onChange={e => setNewCode(p => ({ ...p, maxUsage: e.target.value }))} />
                  </div>
                  <Button onClick={handleCreateCode} className="w-full">Crea Codice</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Codice</th>
                  <th className="pb-3 font-medium">Sconto</th>
                  <th className="pb-3 font-medium">Utilizzi</th>
                  <th className="pb-3 font-medium">Scadenza</th>
                  <th className="pb-3 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {codes.map(c => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                    <td className="py-3 font-mono font-semibold text-foreground">{c.code}</td>
                    <td className="py-3 text-foreground">{c.discount}{c.type === 'percentage' ? '%' : '€'}</td>
                    <td className="py-3 text-muted-foreground">{c.usageCount}/{c.maxUsage}</td>
                    <td className="py-3 text-muted-foreground">{c.expiresAt}</td>
                    <td className="py-3"><StatusBadge status={c.isActive ? 'active' : 'inactive'} /></td>
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

export default ClientHome;
