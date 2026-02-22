import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Monitor, Search, Filter, Loader2, Lock, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { useStations } from "@/hooks/useStations";
import { useAuth } from "@/contexts/AuthContext";

const StationsList = () => {
  const { role, structureIds } = useAuth();
  const structureId = role === "manager" && structureIds.length === 1 ? structureIds[0] : undefined;
  const { data: stations, isLoading } = useStations(structureId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => (stations ?? []).filter(s => {
    // Admin: hide unassigned stations (those belong to Inventory)
    if (role === "admin" && !s.structure_id && !s.owner_id) return false;
    const matchSearch = s.id.toLowerCase().includes(search.toLowerCase()) || s.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  }), [search, statusFilter, stations, role]);

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
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
            <Monitor className="inline mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Stazioni
          </h1>
          <p className="text-muted-foreground">{filtered.length} stazioni trovate</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cerca per ID o tipo..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="AVAILABLE">Disponibile</SelectItem>
                <SelectItem value="BUSY">Occupata</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
                <SelectItem value="MAINTENANCE">Manutenzione</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => (
          <Link key={s.id} to={`/stations/${s.id}`}>
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    {s.visibility === "RESTRICTED" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Solo con QR/codice</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {s.visibility === "HIDDEN" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Nascosta dalla mappa</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <StatusBadge status={s.status ?? "OFFLINE"} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Struttura: {(s as any).structures?.name ?? "—"}</p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.type}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nessuna stazione trovata.</p>
      )}
    </div>
  );
};

export default StationsList;
