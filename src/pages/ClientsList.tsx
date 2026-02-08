import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Search, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { clients } from "@/lib/mock-data";

const ClientsList = () => {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Users className="inline mr-2 h-6 w-6 text-primary" />
          Gestione Clienti
        </h1>
        <p className="text-muted-foreground">{filtered.length} clienti registrati</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cerca clienti..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Telefono</th>
                  <th className="p-4 font-medium">Stazioni</th>
                  <th className="p-4 font-medium">Ricavo Totale</th>
                  <th className="p-4 font-medium">Stato</th>
                  <th className="p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium text-foreground">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{c.email}</td>
                    <td className="p-4 text-muted-foreground">{c.phone}</td>
                    <td className="p-4 text-foreground font-medium">{c.stations}</td>
                    <td className="p-4 font-semibold text-foreground">€{c.totalRevenue.toLocaleString()}</td>
                    <td className="p-4"><StatusBadge status={c.status} /></td>
                    <td className="p-4">
                      <Link to={`/clients/${c.id}`} className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
                        Dettaglio <ArrowRight className="h-3 w-3" />
                      </Link>
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

export default ClientsList;
