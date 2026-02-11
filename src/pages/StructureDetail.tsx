import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Monitor, Loader2, UsersRound, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStructure } from "@/hooks/useStructures";
import { useStations } from "@/hooks/useStations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import InviteUserDialog from "@/components/InviteUserDialog";

const StructureDetail = () => {
  const { id } = useParams();
  const { isPartner, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: structure, isLoading } = useStructure(id);
  const { data: stations, isLoading: stLoading } = useStations(id);
  const [inviteOpen, setInviteOpen] = useState(false);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/structures" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{structure.name}</h1>
          {structure.address && <p className="text-muted-foreground">{structure.address}</p>}
        </div>
      </div>

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations">
            <Monitor className="h-4 w-4 mr-1.5" /> Stazioni
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
                      {s.category && <p className="text-xs text-muted-foreground">Categoria: {s.category}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(stations ?? []).length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nessuna stazione collegata.</p>}
            </div>
          )}
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
