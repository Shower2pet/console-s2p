import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Monitor, Search, Filter, Loader2, Lock, EyeOff, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useStations, useShowcaseStations } from "@/hooks/useStations";
import { useAuth } from "@/contexts/AuthContext";
import StationsMap from "@/components/StationsMap";
import CreateShowcaseDialog from "@/components/CreateShowcaseDialog";
import { deleteStation } from "@/services/stationService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const StationsList = () => {
  const { role, structureIds, isAdmin } = useAuth();
  const structureId = role === "manager" && structureIds.length === 1 ? structureIds[0] : undefined;
  const { data: stations, isLoading } = useStations(structureId);
  const { data: showcaseStations, isLoading: showcaseLoading } = useShowcaseStations();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateShowcase, setShowCreateShowcase] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteStation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stations"] });
      toast.success("Stazione vetrina eliminata");
    },
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  const filtered = useMemo(() => (stations ?? []).filter(s => {
    if (role === "admin" && !s.structure_id && !s.owner_id) return false;
    // Exclude showcase from regular list
    if ((s as any).is_showcase) return false;
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
        </div>
      </div>

      <Tabs defaultValue="operative">
        <TabsList>
          <TabsTrigger value="operative">Operative ({filtered.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="showcase"><Star className="h-3.5 w-3.5 mr-1" />Vetrina ({showcaseStations?.length ?? 0})</TabsTrigger>}
        </TabsList>

        <TabsContent value="operative" className="space-y-6 mt-4">
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

          {/* Map */}
          {(() => {
            const mapPins = filtered.filter(s => {
              const lat = s.geo_lat ?? (s as any).structures?.geo_lat;
              const lng = s.geo_lng ?? (s as any).structures?.geo_lng;
              return lat && lng;
            }).map(s => ({
              id: s.id,
              lat: Number(s.geo_lat ?? (s as any).structures?.geo_lat),
              lng: Number(s.geo_lng ?? (s as any).structures?.geo_lng),
              status: s.status ?? "OFFLINE",
            }));
            return mapPins.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Mappa Stazioni
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 mb-3 flex-wrap">
                    {[
                      { label: "Libera", color: "#22c55e" },
                      { label: "In uso", color: "#3b82f6" },
                      { label: "Manutenzione", color: "#ef4444" },
                      { label: "Offline", color: "#6b7280" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                        {l.label}
                      </div>
                    ))}
                  </div>
                  <StationsMap stations={mapPins} height="350px" />
                </CardContent>
              </Card>
            ) : null;
          })()}

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(s => (
              <Link key={s.id} to={`/stations/${s.id}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                      <div className="flex items-center gap-1.5">
                        {s.visibility === "RESTRICTED" && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><Lock className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent>Solo con QR/codice</TooltipContent></Tooltip></TooltipProvider>
                        )}
                        {s.visibility === "HIDDEN" && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><EyeOff className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger><TooltipContent>Nascosta dalla mappa</TooltipContent></Tooltip></TooltipProvider>
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
        </TabsContent>

        {isAdmin && (
          <TabsContent value="showcase" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Stazioni vetrina: visibili agli utenti sulla mappa, senza logica di pagamento o gestione.
              </p>
              <Button onClick={() => setShowCreateShowcase(true)}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi Vetrina
              </Button>
            </div>

            {showcaseLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {(showcaseStations ?? []).map(s => (
                  <Card key={s.id} className="h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base font-heading">
                            {(s as any).showcase_title || s.id}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.id}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Elimina stazione vetrina</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sei sicuro di voler eliminare la stazione vetrina "{(s as any).showcase_title || s.id}"? Questa azione è irreversibile.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(s.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.type}</span>
                        {s.geo_lat && s.geo_lng && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {Number(s.geo_lat).toFixed(4)}, {Number(s.geo_lng).toFixed(4)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!showcaseLoading && (showcaseStations ?? []).length === 0 && (
              <p className="text-muted-foreground text-center py-8">Nessuna stazione vetrina. Clicca "Aggiungi Vetrina" per crearne una.</p>
            )}

            <CreateShowcaseDialog open={showCreateShowcase} onOpenChange={setShowCreateShowcase} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default StationsList;