import { useState, useEffect } from "react";
import { FileText, Save, Loader2, Plus, Trash2, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const { user, role, profile } = useAuth();
  const qc = useQueryClient();

  // Profile editing
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Fiscal fields from profiles (for partners & admin viewing)
  const [legalName, setLegalName] = useState("");
  const [profileVat, setProfileVat] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");

  useEffect(() => {
    if (profile) {
      setLegalName(profile.legal_name ?? "");
      setProfileVat(profile.vat_number ?? "");
      setFiscalCode(profile.fiscal_code ?? "");
    }
  }, [profile]);

  const updateFiscal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          legal_name: legalName.trim() || null,
          vat_number: profileVat.trim() || null,
          fiscal_code: fiscalCode.trim() || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dati fiscali salvati");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <FileText className="inline mr-2 h-6 w-6 text-primary" />
          {role === "partner" ? "Profilo Fiscale" : "Impostazioni"}
        </h1>
        <p className="text-muted-foreground">Gestisci il tuo profilo e i dati aziendali</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Profilo Utente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Cognome</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Telefono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled className="mt-1.5 opacity-60" />
          </div>
          <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="gap-2">
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" /> Salva Profilo
          </Button>
        </CardContent>
      </Card>

      {/* Fiscal data - only for partners */}
      {(role === "partner" || role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Dati Fiscali (Corrispettivi Telematici)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Ragione Sociale *</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1.5" placeholder="Obbligatorio" />
              {!legalName.trim() && <p className="text-xs text-destructive mt-1">Campo obbligatorio per attivare le stazioni</p>}
            </div>
            <div>
              <Label>Partita IVA *</Label>
              <Input value={profileVat} onChange={(e) => setProfileVat(e.target.value)} className="mt-1.5" placeholder="Obbligatorio" />
              {!profileVat.trim() && <p className="text-xs text-destructive mt-1">Campo obbligatorio per attivare le stazioni</p>}
            </div>
            <div>
              <Label>Codice Fiscale</Label>
              <Input value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value)} className="mt-1.5" />
            </div>
            {role === "admin" && (
              <div>
                <Label>ACube Company ID (solo admin)</Label>
                <Input value={profile?.acube_company_id ?? ""} disabled className="mt-1.5 opacity-60" />
              </div>
            )}
            <Button
              onClick={() => updateFiscal.mutate()}
              disabled={updateFiscal.isPending || !legalName.trim() || !profileVat.trim()}
              className="gap-2"
            >
              {updateFiscal.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" /> Salva Dati Fiscali
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subscription Plans - for partners */}
      {role === "partner" && <SubscriptionPlansSection userId={user!.id} />}
    </div>
  );
};


const SubscriptionPlansSection = ({ userId }: { userId: string }) => {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newInterval, setNewInterval] = useState("month");
  const [newMaxWashes, setNewMaxWashes] = useState("");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["subscription-plans", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscription_plans").insert({
        owner_id: userId,
        name: newName.trim(),
        price_eur: parseFloat(newPrice),
        interval: newInterval,
        max_washes_per_month: newMaxWashes ? parseInt(newMaxWashes) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Piano creato");
      setNewName("");
      setNewPrice("");
      setNewMaxWashes("");
      qc.invalidateQueries({ queryKey: ["subscription-plans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("subscription_plans").update({ is_active: false }).eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Piano disattivato");
      qc.invalidateQueries({ queryKey: ["subscription-plans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> Piani di Abbonamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Existing plans */}
            {(plans ?? []).filter(p => p.is_active).map((plan) => (
              <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    €{Number(plan.price_eur).toFixed(2)} / {plan.interval === "month" ? "mese" : plan.interval === "year" ? "anno" : plan.interval}
                    {plan.max_washes_per_month && ` • Max ${plan.max_washes_per_month} lavaggi/mese`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deletePlan.mutate(plan.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {(plans ?? []).filter(p => p.is_active).length === 0 && (
              <p className="text-sm text-muted-foreground">Nessun piano attivo.</p>
            )}

            {/* Add new plan */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Nuovo Piano</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Es. Piano Base" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Prezzo (€)</Label>
                  <Input type="number" step="0.50" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="9.99" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Durata</Label>
                  <Select value={newInterval} onValueChange={setNewInterval}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mensile</SelectItem>
                      <SelectItem value="year">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Max lavaggi/mese (opz.)</Label>
                  <Input type="number" value={newMaxWashes} onChange={(e) => setNewMaxWashes(e.target.value)} placeholder="Illimitati" className="mt-1" />
                </div>
              </div>
              <Button
                onClick={() => createPlan.mutate()}
                disabled={createPlan.isPending || !newName.trim() || !newPrice}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Crea Piano
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Settings;
