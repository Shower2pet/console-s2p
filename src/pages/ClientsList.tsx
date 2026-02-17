import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Search, ArrowRight, Loader2, Building2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerProfiles } from "@/services/profileService";
import { fetchAllStructuresLight } from "@/services/structureService";

const ClientsList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["clients-profiles"],
    queryFn: fetchPartnerProfiles,
  });

  const { data: structures } = useQuery({
    queryKey: ["clients-structures"],
    queryFn: fetchAllStructuresLight,
  });

  const structureCountMap = (structures ?? []).reduce<Record<string, number>>((acc, s) => {
    if (s.owner_id) acc[s.owner_id] = (acc[s.owner_id] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = (profiles ?? []).filter((p) => {
    const name = (p.legal_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ")).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || (p.email ?? "").toLowerCase().includes(q) || (p.vat_number ?? "").includes(q);
  });

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
            <Users className="inline mr-2 h-6 w-6 text-primary" />
            Gestione Clienti
          </h1>
          <p className="text-muted-foreground">{filtered.length} clienti registrati</p>
        </div>
        <Button onClick={() => navigate("/clients/new")}>
          <UserPlus className="h-4 w-4 mr-2" /> Nuovo Partner
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cerca clienti..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-4 font-medium">Ragione Sociale</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Ruolo</th>
                  <th className="p-4 font-medium">Strutture</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => {
                  const displayName = p.legal_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
                  const initials = displayName.charAt(0).toUpperCase();
                  return (
                    <tr key={p.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${p.id}`)}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {initials}
                          </div>
                          <Link to={`/clients/${p.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{displayName}</Link>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{p.email ?? "—"}</td>
                      <td className="p-4">
                        <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {p.role ?? "user"}
                        </span>
                      </td>
                      <td className="p-4 text-foreground font-medium">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {structureCountMap[p.id] ?? 0}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      Nessun cliente trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsList;
