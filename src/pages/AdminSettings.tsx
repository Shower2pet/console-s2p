import { useState } from "react";
import { Settings, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, Save, Zap, Trash2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerProfiles } from "@/services/profileService";
import { updatePartnerData } from "@/services/profileService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

// ─── Helper: check if partner has all required Fiskaly fields ────────────────
const checkFiskalyFields = (partner: Profile) => {
  const fields = [
    { key: "legal_name", label: "Ragione Sociale" },
    { key: "vat_number", label: "Partita IVA" },
    { key: "address_street", label: "Via/Indirizzo" },
    { key: "zip_code", label: "CAP" },
    { key: "city", label: "Città" },
    { key: "province", label: "Provincia" },
  ] as const;

  return fields.map((f) => ({
    label: f.label,
    ok: Boolean((partner as any)[f.key]?.trim()),
  }));
};

// ─── Partner search + select ─────────────────────────────────────────────────
const PartnerSelector = ({
  selected,
  onSelect,
}: {
  selected: Profile | null;
  onSelect: (p: Profile) => void;
}) => {
  const [search, setSearch] = useState("");
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partnerProfiles"],
    queryFn: fetchPartnerProfiles,
  });

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.legal_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.vat_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-2">
      <Label>Seleziona Partner</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cerca per ragione sociale, email o P.IVA..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Caricamento partner...</p>}
      {search && filtered.length > 0 && (
        <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2"
              onClick={() => {
                onSelect(p);
                setSearch("");
              }}
            >
              <span className="font-medium text-sm">{p.legal_name || p.email}</span>
              <span className="text-xs text-muted-foreground">{p.vat_number}</span>
            </button>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">Nessun partner trovato.</p>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
const AdminSettings = () => {
  const [selectedPartner, setSelectedPartner] = useState<Profile | null>(null);
  const [manualSystemId, setManualSystemId] = useState("");
  const [manualEntityId, setManualEntityId] = useState("");
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [loadingSystemId, setLoadingSystemId] = useState(false);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  // Refresh partner data after operations
  const [partnerData, setPartnerData] = useState<Profile | null>(null);
  const displayPartner = partnerData ?? selectedPartner;

  const handleSelectPartner = (p: Profile) => {
    setSelectedPartner(p);
    setPartnerData(null);
    setManualSystemId(p.fiskaly_system_id ?? "");
    setManualEntityId("");
  };

  const refreshPartner = async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) setPartnerData(data as Profile);
  };

  // ── A. Configura automaticamente ─────────────────────────────────────────
  const handleAutoSetup = async () => {
    if (!displayPartner) return;
    setLoadingAuto(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: displayPartner.id, force: true },
      });
      if (error || data?.error) {
        const msg = data?.error ?? error?.message;
        const instructions = data?.instructions as string[] | undefined;
        toast.error(msg, {
          description: instructions ? instructions.join("\n") : data?.details,
          duration: 10000,
        });
      } else {
        toast.success(data.message ?? "Configurazione completata!");
        await refreshPartner(displayPartner.id);
      }
    } finally {
      setLoadingAuto(false);
    }
  };

  // ── B. Salva System ID manuale ────────────────────────────────────────────
  const handleSaveSystemId = async () => {
    if (!displayPartner || !manualSystemId.trim()) return;
    setLoadingSystemId(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: displayPartner.id, system_id: manualSystemId.trim() },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message);
      } else {
        toast.success("System ID salvato con successo!");
        await refreshPartner(displayPartner.id);
      }
    } finally {
      setLoadingSystemId(false);
    }
  };

  // ── C. Configura da Entity esistente ─────────────────────────────────────
  const handleEntitySetup = async () => {
    if (!displayPartner || !manualEntityId.trim()) return;
    setLoadingEntity(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: displayPartner.id, entity_id: manualEntityId.trim(), force: true },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message, {
          description: data?.details,
          duration: 8000,
        });
      } else {
        toast.success(data.message ?? "Configurazione da Entity completata!");
        setManualEntityId("");
        await refreshPartner(displayPartner.id);
      }
    } finally {
      setLoadingEntity(false);
    }
  };

  // ── D. Reset System ID ────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!displayPartner) return;
    setLoadingReset(true);
    try {
      await updatePartnerData(displayPartner.id, { fiskaly_system_id: null });
      toast.success("System ID azzerato. Il partner può essere riconfigurato da zero.");
      setManualSystemId("");
      await refreshPartner(displayPartner.id);
    } catch (e: any) {
      toast.error(e.message ?? "Errore nel reset");
    } finally {
      setLoadingReset(false);
    }
  };

  const fiskalyFields = displayPartner ? checkFiskalyFields(displayPartner) : [];
  const allFieldsOk = fiskalyFields.every((f) => f.ok);
  const hasSystemId = Boolean(displayPartner?.fiskaly_system_id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Settings className="inline mr-2 h-6 w-6 text-primary" />
          Impostazioni Sistema
        </h1>
        <p className="text-muted-foreground">Configurazione globale della piattaforma</p>
      </div>

      {/* ── Sezione Gestione Fiskaly ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Gestione Fiskaly
          </CardTitle>
          <CardDescription>
            Diagnostica e configurazione manuale del sistema fiscale per i partner.
            Usa questa sezione per sbloccare partner con entity corrotte o per inserire System ID esistenti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── A. Partner selector + diagnostica ──────────────────────────── */}
          <PartnerSelector selected={displayPartner} onSelect={handleSelectPartner} />

          {displayPartner && (
            <>
              {/* Diagnostica partner */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-foreground">{displayPartner.legal_name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">P.IVA: {displayPartner.vat_number ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{displayPartner.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">Fiskaly System ID</span>
                    {hasSystemId ? (
                      <Badge variant="default" className="font-mono text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {displayPartner.fiskaly_system_id}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Non configurato
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stato campi obbligatori */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Campi obbligatori per Fiskaly:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {fiskalyFields.map((f) => (
                      <div key={f.label} className="flex items-center gap-1.5 text-xs">
                        {f.ok ? (
                          <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className={f.ok ? "text-foreground" : "text-destructive"}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  {!allFieldsOk && (
                    <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Completa i campi mancanti nel dettaglio partner prima di configurare Fiskaly.
                    </p>
                  )}
                </div>

                {/* Pulsante configurazione automatica */}
                <Button
                  onClick={handleAutoSetup}
                  disabled={loadingAuto || !allFieldsOk}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingAuto ? "animate-spin" : ""}`} />
                  {loadingAuto ? "Configurazione in corso..." : "Configura automaticamente su Fiskaly"}
                </Button>
              </div>

              <Separator />

              {/* ── B. Override manuale System ID ────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Salva System ID manuale</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usa quando il System esiste già su Fiskaly ma non è salvato nel database.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="es. 01961234-abcd-7000-1234-abcdef012345"
                    value={manualSystemId}
                    onChange={(e) => setManualSystemId(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleSaveSystemId}
                    disabled={loadingSystemId || !manualSystemId.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Save className={`h-4 w-4 mr-2 ${loadingSystemId ? "animate-spin" : ""}`} />
                    Salva
                  </Button>
                </div>
              </div>

              <Separator />

              {/* ── C. Configura da Entity ID esistente ──────────────────── */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Configura da Entity esistente</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Usa quando l'entity esiste già su Fiskaly con un UUID v7 valido (es. caso WashDog).
                    La funzione eseguirà solo il commissioning e la creazione del System, saltando la creazione dell'entity.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Entity ID (UUID v7) es. 01961234-abcd-7000-..."
                    value={manualEntityId}
                    onChange={(e) => setManualEntityId(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleEntitySetup}
                    disabled={loadingEntity || !manualEntityId.trim()}
                    variant="outline"
                    className="shrink-0"
                  >
                    <Zap className={`h-4 w-4 mr-2 ${loadingEntity ? "animate-spin" : ""}`} />
                    Configura
                  </Button>
                </div>
              </div>

              <Separator />

              {/* ── D. Reset System ID ───────────────────────────────────── */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Azzera System ID</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Imposta <code className="bg-muted px-1 rounded text-xs">fiskaly_system_id = null</code> nel profilo,
                    permettendo una riconfigurazione completa da zero.
                  </p>
                </div>
                <Button
                  onClick={handleReset}
                  disabled={loadingReset || !hasSystemId}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className={`h-4 w-4 mr-2 ${loadingReset ? "animate-spin" : ""}`} />
                  {loadingReset ? "Reset in corso..." : "Azzera System ID"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Configurazione Generale (placeholder) ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Configurazione Generale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Le impostazioni di sistema saranno disponibili in una versione futura.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
