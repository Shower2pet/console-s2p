import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Monitor, Loader2, UsersRound, UserPlus, MapPin, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStructure, useUpdateStructure } from "@/hooks/useStructures";
import { useStations } from "@/hooks/useStations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import InviteUserDialog from "@/components/InviteUserDialog";
import MapPicker from "@/components/MapPicker";
import StationsMap from "@/components/StationsMap";
import { toast } from "sonner";

const StructureDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPartner, isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data: structure, isLoading } = useStructure(id);
  const { data: stations, isLoading: stLoading } = useStations(id);
  const updateStructure = useUpdateStructure();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Initialize map coords from structure
  if (structure && !mapInitialized) {
    setMapLat(structure.geo_lat ? Number(structure.geo_lat) : null);
    setMapLng(structure.geo_lng ? Number(structure.geo_lng) : null);
    setMapInitialized(true);
  }

  const handleSavePosition = async () => {
    if (!structure || mapLat == null || mapLng == null) return;
    try {
      await updateStructure.mutateAsync({ id: structure.id, geo_lat: mapLat, geo_lng: mapLng });
      toast.success("Posizione struttura aggiornata");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const canEditPosition = isAdmin || isPartner || isManager;

  // Fetch managers for this structure
  const { data: managers, isLoading: managersLoading } = useQuery({
    queryKey: ["structure-managers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structure_managers")
        .select("id, user_id, created_at, permissions")
        .eq("structure_id", id!);
      if (error) throw error;

      // Fetch profile info for each manager
      const userIds = data.map((m) => m.user_id).filter(Boolean) as string[];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      return data.map((m) => ({
        ...m,
        profile: m.user_id ? profileMap.get(m.user_id) : null,
      }));
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!structure) return <div className="p-6 text-muted-foreground">Struttura non trovata.</div>;

  const showTeamTab = isPartner || isAdmin;

  const handleDeleteStructure = async () => {
    if (!structure || deleteConfirmName !== structure.name) return;
    try {
      // Set stations to unassigned/offline
      await supabase.from("stations").update({ structure_id: null, status: "OFFLINE" } as any).eq("structure_id", structure.id);
      // Delete structure
      const { error } = await supabase.from("structures").delete().eq("id", structure.id);
      if (error) throw error;
      toast.success("Struttura eliminata");
      navigate("/structures");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/structures" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{structure.name}</h1>
            {structure.address && <p className="text-muted-foreground">{structure.address}</p>}
          </div>
        </div>
        {(isAdmin || isPartner) && (
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Elimina Struttura
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-foreground">
              Per eliminare la struttura, digita <strong>"{structure.name}"</strong> nel campo sottostante:
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Digita il nome della struttura..."
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setDeleteConfirmName(""); }}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirmName !== structure.name}
                onClick={handleDeleteStructure}
              >
                Conferma Eliminazione
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations">
            <Monitor className="h-4 w-4 mr-1.5" /> Stazioni
          </TabsTrigger>
          <TabsTrigger value="position">
            <MapPin className="h-4 w-4 mr-1.5" /> Posizione
          </TabsTrigger>
          {showTeamTab && (
            <TabsTrigger value="team">
              <UsersRound className="h-4 w-4 mr-1.5" /> Team & Gestori
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stations">
          {stLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6">
              {/* Stations Map */}
              {(() => {
                const mapPins = (stations ?? []).filter(s => {
                  const lat = s.geo_lat ?? (s as any).structures?.geo_lat ?? structure.geo_lat;
                  const lng = s.geo_lng ?? (s as any).structures?.geo_lng ?? structure.geo_lng;
                  return lat && lng;
                }).map(s => ({
                  id: s.id,
                  lat: Number(s.geo_lat ?? (s as any).structures?.geo_lat ?? structure.geo_lat),
                  lng: Number(s.geo_lng ?? (s as any).structures?.geo_lng ?? structure.geo_lng),
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
                      <StationsMap stations={mapPins} height="300px" />
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(stations ?? []).map((s) => (
                  <Link key={s.id} to={`/stations/${s.id}`}>
                    <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                          <StatusBadge status={s.status ?? "OFFLINE"} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type}</p>
                        {s.category && <p className="text-xs text-muted-foreground">Categoria: {String(s.category)}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {(stations ?? []).length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nessuna stazione collegata.</p>}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="position">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Posizione Struttura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mapLat != null && mapLng != null && (
                <p className="text-sm text-muted-foreground">
                  Lat: {mapLat.toFixed(6)}, Lng: {mapLng.toFixed(6)}
                </p>
              )}
              <MapPicker
                lat={mapLat}
                lng={mapLng}
                onChange={(lat, lng) => { setMapLat(lat); setMapLng(lng); }}
                readonly={!canEditPosition}
                height="400px"
              />
              {canEditPosition && (
                <Button
                  onClick={handleSavePosition}
                  disabled={updateStructure.isPending || mapLat == null}
                  className="w-full gap-2"
                >
                  <Save className="h-4 w-4" /> Salva Posizione
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showTeamTab && (
          <TabsContent value="team">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-heading font-semibold text-foreground">Gestori Assegnati</h2>
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Aggiungi Gestore
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {managersLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : (managers ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nessun gestore assegnato a questa struttura.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-4 font-medium">Nome</th>
                          <th className="p-4 font-medium">Email</th>
                          <th className="p-4 font-medium">Aggiunto il</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(managers ?? []).map((m) => {
                          const name = m.profile
                            ? [m.profile.first_name, m.profile.last_name].filter(Boolean).join(" ") || "—"
                            : "—";
                          return (
                            <tr key={m.id}>
                              <td className="p-4 font-medium text-foreground">{name}</td>
                              <td className="p-4 text-muted-foreground">{m.profile?.email ?? "—"}</td>
                              <td className="p-4 text-muted-foreground">
                                {m.created_at ? new Date(m.created_at).toLocaleDateString("it-IT") : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <InviteUserDialog
                open={inviteOpen}
                onOpenChange={setInviteOpen}
                role="manager"
                structureId={id}
                title="Invita Nuovo Gestore"
                description={`Il gestore verrà assegnato alla struttura "${structure.name}".`}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["structure-managers", id] })}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default StructureDetail;
