import { useState } from "react";
import {
  Settings, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, Save,
  Zap, Trash2, Building2, Globe, ChevronDown, ChevronRight, PenLine, Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { fetchPartnerProfiles } from "@/services/profileService";
import { updatePartnerData } from "@/services/profileService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

// ─── Helper ──────────────────────────────────────────────────────────────────
const checkFiskalyFields = (partner: Profile) => {
  const fields = [
    { key: "legal_name", label: "Ragione Sociale" },
    { key: "vat_number", label: "Partita IVA" },
    { key: "address_street", label: "Via/Indirizzo" },
    { key: "zip_code", label: "CAP" },
    { key: "city", label: "Città" },
    { key: "province", label: "Provincia" },
  ] as const;
  return fields.map((f) => ({ label: f.label, ok: Boolean((partner as any)[f.key]?.trim()) }));
};

// ─── Partner Selector ─────────────────────────────────────────────────────────
const PartnerSelector = ({ onSelect }: { onSelect: (p: Profile) => void }) => {
  const [search, setSearch] = useState("");
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partnerProfiles"],
    queryFn: fetchPartnerProfiles,
  });

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    return p.legal_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.vat_number?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <Label>Seleziona Partner</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cerca per ragione sociale, email o P.IVA..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {search && filtered.length > 0 && (
        <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2" onClick={() => { onSelect(p); setSearch(""); }}>
              <span className="font-medium text-sm">{p.legal_name || p.email}</span>
              <span className="text-xs text-muted-foreground">{p.vat_number}</span>
            </button>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">Nessun partner trovato.</p>}
    </div>
  );
};

// ─── JSON Collapsible Row ────────────────────────────────────────────────────
const JsonRow = ({ label, data }: { label: string; data: unknown }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted transition-colors text-sm font-medium" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <pre className="p-3 text-xs overflow-x-auto bg-background text-foreground whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface FiskalyEntity {
  content: {
    id: string;
    state: string;
    type: string;
    name?: { legal?: string; trade?: string };
    address?: { code?: string; city?: string };
  };
  metadata?: Record<string, string>;
}
interface FiskalyUnitResult {
  unit_id: string;
  unit_name: string;
  unit_state?: string;
  unit_metadata?: Record<string, string>;
  entities: FiskalyEntity[];
  error?: string;
}

// ─── Fiskaly Explorer Tab ────────────────────────────────────────────────────
const FiskalyExplorer = () => {
  const [unitResults, setUnitResults] = useState<FiskalyUnitResult[] | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [decommLoading, setDecommLoading] = useState<string | null>(null); // entityId being decommissioned
  const [patchResourceId, setPatchResourceId] = useState("");
  const [patchResource, setPatchResource] = useState<"assets" | "entities" | "systems">("assets");
  const [patchPayload, setPatchPayload] = useState('{"content": {"state": "DISABLED"}}');
  const [patchResult, setPatchResult] = useState<unknown | null>(null);
  const [patchLoading, setPatchLoading] = useState(false);

  const handleLoadUnits = async () => {
    setLoadingUnits(true);
    setUnitResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-explorer", {
        body: { action: "list_unit_entities" },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message);
      } else {
        setUnitResults(data.results ?? []);
      }
    } finally {
      setLoadingUnits(false);
    }
  };

  const handleDecommission = async (entityId: string, unitAssetId: string) => {
    setDecommLoading(entityId);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-explorer", {
        body: { action: "decommission_entity", resource: "entities", resource_id: entityId, unit_asset_id: unitAssetId },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Errore decommission");
      } else if (data?.ok || data?.status === 200) {
        toast.success("Entity decommissionata ✓");
        // Optimistic update: mark entity as DECOMMISSIONED in state
        setUnitResults((prev) =>
          prev?.map((u) =>
            u.unit_id === unitAssetId
              ? {
                  ...u,
                  entities: u.entities.map((e) =>
                    e.content.id === entityId ? { ...e, content: { ...e.content, state: "DECOMMISSIONED" } } : e
                  ),
                }
              : u
          ) ?? prev
        );
      } else {
        toast.warning(`Fiskaly risposta ${data?.status} — potrebbe non essere riuscito`);
      }
    } finally {
      setDecommLoading(null);
    }
  };


  const handlePatch = async () => {
    if (!patchResourceId.trim()) return;
    setPatchLoading(true);
    setPatchResult(null);
    try {
      let parsedPayload: unknown;
      try { parsedPayload = JSON.parse(patchPayload); } catch { toast.error("JSON payload non valido"); return; }
      const { data, error } = await supabase.functions.invoke("fiskaly-explorer", {
        body: { action: "patch", resource: patchResource, resource_id: patchResourceId.trim(), payload: parsedPayload },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message);
      } else {
        setPatchResult(data);
        toast.success(`PATCH ${patchResource}/${patchResourceId.trim()} → ${data.status}`);
      }
    } finally {
      setPatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Interfaccia diretta con le API Fiskaly. Fiskaly è fiscalmente immutabile — non esistono endpoint DELETE.
        Le entità e i sistemi sono visibili solo tramite token scoped alla UNIT di appartenenza.
      </p>

      {/* ── LISTA UNIT + ENTITÀ ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-foreground">UNIT Assets e loro Entità</h3>
          <Button size="sm" variant="outline" onClick={handleLoadUnits} disabled={loadingUnits} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingUnits ? "animate-spin" : ""}`} />
            {loadingUnits ? "Caricamento..." : "Carica UNIT e Entità"}
          </Button>
        </div>

        {unitResults !== null && unitResults.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna UNIT trovata.</p>
        )}

        {unitResults && unitResults.map((unit) => {
          const isUnitDisabled = unit.unit_state === "DISABLED";
          return (
            <div key={unit.unit_id} className={`border rounded-lg overflow-hidden ${isUnitDisabled ? "opacity-60" : ""}`}>
              {/* UNIT header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm">{unit.unit_name}</span>
                  <Badge variant={isUnitDisabled ? "secondary" : "outline"} className="text-xs font-mono shrink-0">
                    {unit.unit_state ?? "ENABLED"}
                  </Badge>
                  {unit.unit_metadata?.partner_id && (
                    <span className="text-xs text-muted-foreground truncate">partner: {unit.unit_metadata.partner_id.slice(0, 8)}…</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs text-muted-foreground">{unit.unit_id}</span>
                </div>
              </div>

              {/* Entity list */}
              {unit.error && (
                <div className="px-4 py-2 text-xs text-destructive">{unit.error}</div>
              )}
              {unit.entities.length === 0 && !unit.error && (
                <div className="px-4 py-2.5 text-xs text-muted-foreground">Nessuna entity in questa UNIT.</div>
              )}
              {unit.entities.map((entity) => {
                const eid = entity.content.id;
                const estate = entity.content.state;
                const ename = entity.content.name?.legal ?? eid;
                const ecity = entity.content.address?.city;
                const ecode = entity.content.address?.code;
                const isDecomm = estate === "DECOMMISSIONED";
                const isLoading = decommLoading === eid;

                return (
                  <div
                    key={eid}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t text-sm flex-wrap ${isDecomm ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{ename}</span>
                          <Badge
                            variant={isDecomm ? "secondary" : estate === "COMMISSIONED" ? "default" : "outline"}
                            className="text-xs shrink-0"
                          >
                            {estate}
                          </Badge>
                          {ecity && <span className="text-xs text-muted-foreground">{ecity}{ecode ? `, ${ecode}` : ""}</span>}
                          {!ecity && <span className="text-xs text-destructive">⚠ no address</span>}
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{eid}</span>
                      </div>
                    </div>
                    {!isDecomm && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1.5 shrink-0"
                        onClick={() => handleDecommission(eid, unit.unit_id)}
                        disabled={isLoading}
                      >
                        <Ban className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        {isLoading ? "..." : "Decommissiona"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* ── PATCH MANUALE ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
            <PenLine className="h-4 w-4" /> Aggiorna Risorsa (PATCH manuale)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per operazioni avanzate su entities e systems. Nota: gli asset UNIT non supportano il campo <code className="bg-muted px-1 rounded">state</code> via PATCH (risposta 400 da Fiskaly).
          </p>
        </div>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <Label className="text-xs">Risorsa</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={patchResource}
                onChange={(e) => setPatchResource(e.target.value as any)}
              >
                <option value="assets">assets</option>
                <option value="entities">entities</option>
                <option value="systems">systems</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs">Resource ID (UUID)</Label>
              <Input
                placeholder="es. 928af8e9-9b66-4734-..."
                value={patchResourceId}
                onChange={(e) => setPatchResourceId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Payload JSON</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
              value={patchPayload}
              onChange={(e) => setPatchPayload(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handlePatch} disabled={patchLoading || !patchResourceId.trim()} className="w-fit">
            <PenLine className={`h-4 w-4 mr-2 ${patchLoading ? "animate-spin" : ""}`} />
            {patchLoading ? "Invio..." : `PATCH /${patchResource}/:id`}
          </Button>
          {patchResult && <JsonRow label="Risposta PATCH" data={patchResult} />}
        </div>
      </div>

      <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Note API Fiskaly (SIGN IT 2025-08-12):</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>UNIT Assets</strong>: contenitori organizzativi. <span className="text-destructive">Non supportano il campo state via PATCH</span> — non disabilitabili via API.</li>
          <li><strong>Entities</strong>: dati fiscali del partner, visibili solo con token scoped alla UNIT. Non eliminabili — solo decommissionabili (pulsante nella lista).</li>
          <li><strong>Systems</strong>: dispositivi fiscali. Non eliminabili per legge fiscale italiana.</li>
        </ul>
      </div>
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
const AdminSettings = () => {
  const [selectedPartner, setSelectedPartner] = useState<Profile | null>(null);
  const [manualSystemId, setManualSystemId] = useState("");
  const [manualEntityId, setManualEntityId] = useState("");
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [loadingSystemId, setLoadingSystemId] = useState(false);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
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

  const handleAutoSetup = async () => {
    if (!displayPartner) return;
    setLoadingAuto(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", { body: { partner_id: displayPartner.id, force: true } });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message, { description: data?.details ?? (data?.instructions as string[] | undefined)?.join("\n"), duration: 10000 });
      } else {
        toast.success(data.message ?? "Configurazione completata!");
        await refreshPartner(displayPartner.id);
      }
    } finally { setLoadingAuto(false); }
  };

  const handleSaveSystemId = async () => {
    if (!displayPartner || !manualSystemId.trim()) return;
    setLoadingSystemId(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", { body: { partner_id: displayPartner.id, system_id: manualSystemId.trim() } });
      if (error || data?.error) { toast.error(data?.error ?? error?.message); }
      else { toast.success("System ID salvato!"); await refreshPartner(displayPartner.id); }
    } finally { setLoadingSystemId(false); }
  };

  const handleEntitySetup = async () => {
    if (!displayPartner || !manualEntityId.trim()) return;
    setLoadingEntity(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", { body: { partner_id: displayPartner.id, entity_id: manualEntityId.trim(), force: true } });
      if (error || data?.error) { toast.error(data?.error ?? error?.message, { description: data?.details, duration: 8000 }); }
      else { toast.success(data.message ?? "Configurazione completata!"); setManualEntityId(""); await refreshPartner(displayPartner.id); }
    } finally { setLoadingEntity(false); }
  };

  const handleReset = async () => {
    if (!displayPartner) return;
    setLoadingReset(true);
    try {
      await updatePartnerData(displayPartner.id, { fiskaly_system_id: null });
      toast.success("System ID azzerato.");
      setManualSystemId("");
      await refreshPartner(displayPartner.id);
    } catch (e: any) { toast.error(e.message ?? "Errore nel reset"); }
    finally { setLoadingReset(false); }
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Gestione Fiskaly
          </CardTitle>
          <CardDescription>
            Strumenti di diagnostica, configurazione manuale e accesso diretto alle API Fiskaly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="gestione">
            <TabsList className="mb-6">
              <TabsTrigger value="gestione">Gestione Partner</TabsTrigger>
              <TabsTrigger value="explorer" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> API Explorer
              </TabsTrigger>
            </TabsList>

            {/* ── TAB 1: Gestione Partner ────────────────────────────────── */}
            <TabsContent value="gestione" className="space-y-6">
              <PartnerSelector onSelect={handleSelectPartner} />

              {displayPartner && (
                <>
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
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Campi obbligatori per Fiskaly:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {fiskalyFields.map((f) => (
                          <div key={f.label} className="flex items-center gap-1.5 text-xs">
                            {f.ok ? <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
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
                    <Button onClick={handleAutoSetup} disabled={loadingAuto || !allFieldsOk} className="w-full">
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingAuto ? "animate-spin" : ""}`} />
                      {loadingAuto ? "Configurazione in corso..." : "Configura automaticamente su Fiskaly"}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-sm text-foreground">Salva System ID manuale</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Usa quando il System esiste già su Fiskaly (visibile nell'API Explorer) ma non è salvato nel DB.</p>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="System ID (UUID)" value={manualSystemId} onChange={(e) => setManualSystemId(e.target.value)} className="font-mono text-sm" />
                      <Button onClick={handleSaveSystemId} disabled={loadingSystemId || !manualSystemId.trim()} variant="outline" className="shrink-0">
                        <Save className={`h-4 w-4 mr-2 ${loadingSystemId ? "animate-spin" : ""}`} />
                        Salva
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-sm text-foreground">Configura da Entity esistente</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Usa un Entity ID (UUID v7) esistente su Fiskaly — trovalo nell'API Explorer cliccando <strong>GET /entities</strong>.
                        La funzione eseguirà solo commissioning + creazione System.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Entity ID (UUID v7)" value={manualEntityId} onChange={(e) => setManualEntityId(e.target.value)} className="font-mono text-sm" />
                      <Button onClick={handleEntitySetup} disabled={loadingEntity || !manualEntityId.trim()} variant="outline" className="shrink-0">
                        <Zap className={`h-4 w-4 mr-2 ${loadingEntity ? "animate-spin" : ""}`} />
                        Configura
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-sm text-foreground">Azzera System ID</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Imposta <code className="bg-muted px-1 rounded text-xs">fiskaly_system_id = null</code> per riconfigurare da zero.
                      </p>
                    </div>
                    <Button onClick={handleReset} disabled={loadingReset || !hasSystemId} variant="destructive" size="sm">
                      <Trash2 className={`h-4 w-4 mr-2 ${loadingReset ? "animate-spin" : ""}`} />
                      {loadingReset ? "Reset..." : "Azzera System ID"}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── TAB 2: API Explorer ────────────────────────────────────── */}
            <TabsContent value="explorer">
              <FiskalyExplorer />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
