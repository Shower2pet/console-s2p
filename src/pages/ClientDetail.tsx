import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Monitor, Loader2, Mail, Phone, User, Trash2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DeletePartnerDialog from "@/components/DeletePartnerDialog";
import StaticMapPreview from "@/components/StaticMapPreview";
import AssignStationDialog from "@/components/AssignStationDialog";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["client-profile", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: structures, isLoading: structLoading } = useQuery({
    queryKey: ["client-structures", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structures")
        .select("*")
        .eq("owner_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // All stations owned by this partner (both assigned to structures and unassigned)
  const { data: stations } = useQuery({
    queryKey: ["client-stations-all", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*, structures(name)")
        .eq("owner_id", id!)
        .order("id");
      if (error) throw error;
      return data;
    },
  });

  if (profileLoading || structLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <div className="p-6 text-muted-foreground">Cliente non trovato.</div>;

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";

  const handleDeletePartner = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: id },
      });
      if (error) {
        const msg = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Partner eliminato con successo");
      navigate("/clients");
    } catch (err: any) {
      toast.error(err.message ?? "Errore durante l'eliminazione");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clients" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{displayName}</h1>
            <p className="text-muted-foreground capitalize">{profile.role ?? "user"}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Elimina Partner
        </Button>
      </div>

      <DeletePartnerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        partnerName={displayName}
        onConfirm={handleDeletePartner}
      />

      {/* Profile info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Informazioni Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{profile.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{profile.phone ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="capitalize rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {profile.role ?? "user"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Structures */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Strutture ({(structures ?? []).length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(structures ?? []).map((s) => (
            <Link key={s.id} to={`/structures/${s.id}`}>
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
              <StaticMapPreview lat={s.geo_lat} lng={s.geo_lng} height="100px" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.address}
                  </p>
                )}
              </CardContent>
            </Card>
            </Link>
          ))}
          {(structures ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna struttura.</p>
          )}
        </div>
      </div>

      {/* Stations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> Stazioni ({(stations ?? []).length})
          </h2>
          <AssignStationDialog partnerId={id!} partnerName={displayName} prominent />
        </div>
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
                  <p className="text-xs text-muted-foreground">Struttura: {(s as any).structures?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type} {s.category ? `• ${s.category}` : ""}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(stations ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna stazione.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;
