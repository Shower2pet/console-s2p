import { Tag, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { discountCodes as initialCodes } from "@/lib/mock-data";

const Marketing = () => {
  const [codes, setCodes] = useState(initialCodes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({ code: '', discount: '', type: 'percentage' as 'percentage' | 'fixed', maxUsage: '' });

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

  const handleDelete = (id: string) => {
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            <Tag className="inline mr-2 h-6 w-6 text-primary" />
            Marketing & Codici Sconto
          </h1>
          <p className="text-muted-foreground">{codes.filter(c => c.isActive).length} codici attivi</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading">Codici Sconto</CardTitle>
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
                  <th className="pb-3 font-medium text-right">Azioni</th>
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
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
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

export default Marketing;
