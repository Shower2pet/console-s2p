import { useState, useEffect } from "react";
import { FileText, Save, Loader2 } from "lucide-react";
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

  // Fiscal data (only for partners)
  const { data: fiscalData, isLoading: fiscalLoading } = useQuery({
    queryKey: ["fiscal-data", user?.id],
    enabled: role === "partner" && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners_fiscal_data")
        .select("*")
        .eq("profile_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [businessName, setBusinessName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [sdiCode, setSdiCode] = useState("");

  useEffect(() => {
    if (fiscalData) {
      setBusinessName(fiscalData.business_name ?? "");
      setVatNumber(fiscalData.vat_number ?? "");
      setSdiCode(fiscalData.sdi_code ?? "");
    }
  }, [fiscalData]);

  const upsertFiscal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("partners_fiscal_data")
        .upsert({
          profile_id: user!.id,
          business_name: businessName.trim(),
          vat_number: vatNumber.trim(),
          sdi_code: sdiCode.trim() || null,
        }, { onConflict: "profile_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dati fiscali salvati");
      qc.invalidateQueries({ queryKey: ["fiscal-data"] });
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
      {role === "partner" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Dati Fiscali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fiscalLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <div>
                  <Label>Ragione Sociale</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1.5" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Partita IVA</Label>
                    <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Codice SDI</Label>
                    <Input value={sdiCode} onChange={(e) => setSdiCode(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <Button
                  onClick={() => upsertFiscal.mutate()}
                  disabled={upsertFiscal.isPending || !businessName.trim() || !vatNumber.trim()}
                  className="gap-2"
                >
                  {upsertFiscal.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" /> Salva Dati Fiscali
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
