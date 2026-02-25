import { useState } from "react";
import {
  Settings, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, Save,
  Zap, Trash2, Building2, Globe, ChevronDown, ChevronRight, PenLine, Ban,
  ShieldCheck, ShieldAlert, Link2, RotateCcw, Bug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPartnerProfiles } from "@/services/profileService";
import { updatePartnerData } from "@/services/profileService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types/database";
import { AdminErrorLogs } from "@/components/AdminErrorLogs";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FISKALY_REQUIRED_FIELDS = [
  { key: "legal_name", label: "Ragione Sociale" },
  { key: "vat_number", label: "Partita IVA" },
  { key: "address_street", label: "Via/Indirizzo" },
  { key: "zip_code", label: "CAP" },
  { key: "city", label: "Città" },
  { key: "province", label: "Provincia" },
] as const;

const checkFiskalyFields = (partner: Profile) =>
  FISKALY_REQUIRED_FIELDS.map((f) => ({
    label: f.label,
    ok: Boolean((partner as any)[f.key]?.trim()),
  }));

const getFiskalyStatus = (partner: Profile) => {
  const fields = checkFiskalyFields(partner);
  const dataOk = fields.every((f) => f.ok);
  const hasSystem = Boolean(partner.fiskaly_system_id);
  const hasEntity = Boolean(partner.fiskaly_entity_id);
  const hasUnit = Boolean(partner.fiskaly_unit_id);
  if (hasSystem && hasEntity && hasUnit && dataOk) return "full";
  if (hasSystem && dataOk) return "system_ok";
  if (!dataOk) return "missing_data";
  return "not_configured";
};

// ─── JSON Collapsible ────────────────────────────────────────────────────────
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

// ─── Partner Fiscal Row (inside table) ───────────────────────────────────────
const PartnerFiscalRow = ({
  partner,
  onRefresh,
}: {
  partner: Profile;
  onRefresh: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [manualSystemId, setManualSystemId] = useState("");
  const [loadingSave, setLoadingSave] = useState(false);

  const status = getFiskalyStatus(partner);
  const fields = checkFiskalyFields(partner);
  const dataOk = fields.every((f) => f.ok);

  const statusBadge = {
    full: <Badge variant="default" className="gap-1 text-xs"><ShieldCheck className="h-3 w-3" />Configurato</Badge>,
    system_ok: <Badge variant="default" className="gap-1 text-xs bg-primary/80"><ShieldCheck className="h-3 w-3" />System OK</Badge>,
    missing_data: <Badge variant="secondary" className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Dati mancanti</Badge>,
    not_configured: <Badge variant="destructive" className="gap-1 text-xs"><ShieldAlert className="h-3 w-3" />Non configurato</Badge>,
  }[status];

  const handleAutoSetup = async () => {
    setLoadingSetup(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: partner.id, force: !!partner.fiskaly_system_id },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Errore", { duration: 8000 });
      } else {
        toast.success(data.message ?? "Configurazione completata!");
        onRefresh();
      }
    } finally { setLoadingSetup(false); }
  };

  const handleSaveManual = async () => {
    if (!manualSystemId.trim()) return;
    setLoadingSave(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: partner.id, system_id: manualSystemId.trim() },
      });
      if (error || data?.error) { toast.error(data?.error ?? error?.message); }
      else { toast.success("System ID salvato!"); setManualSystemId(""); onRefresh(); }
    } finally { setLoadingSave(false); }
  };

  const handleReset = async () => {
    setLoadingReset(true);
    try {
      await updatePartnerData(partner.id, {
        fiskaly_system_id: null,
        fiskaly_entity_id: null,
        fiskaly_unit_id: null,
      } as any);
      toast.success("IDs Fiskaly azzerati.");
      onRefresh();
    } catch (e: any) { toast.error(e.message ?? "Errore"); }
    finally { setLoadingReset(false); }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{partner.legal_name ?? partner.email}</span>
            <span className="text-xs text-muted-foreground">{partner.vat_number ?? "—"}</span>
          </div>
          <span className="text-xs text-muted-foreground">{partner.email}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge}
          <Button
            size="sm"
            variant={partner.fiskaly_system_id ? "outline" : "default"}
            className="h-7 text-xs gap-1"
            disabled={loadingSetup || !dataOk}
            onClick={handleAutoSetup}
            title={!dataOk ? "Completa i dati fiscali nel profilo partner" : ""}
          >
            {loadingSetup ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {partner.fiskaly_system_id ? "Riconfigura" : "Configura"}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
          {/* Fiscal data fields status */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Dati fiscali:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {fields.map((f) => (
                <div key={f.label} className="flex items-center gap-1 text-xs">
                  {f.ok ? <CheckCircle className="h-3 w-3 text-primary shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                  <span className={f.ok ? "text-foreground" : "text-destructive"}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fiskaly IDs in DB */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">IDs salvati nel DB:</p>
            <div className="space-y-1">
              {[
                { label: "UNIT", value: partner.fiskaly_unit_id },
                { label: "Entity", value: partner.fiskaly_entity_id },
                { label: "System", value: partner.fiskaly_system_id },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-muted-foreground shrink-0">{label}</span>
                  {value ? (
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground truncate flex-1">{value}</code>
                  ) : (
                    <span className="text-destructive/70 italic">non configurato</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Manual system ID */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Salva System ID manuale:</p>
            <div className="flex gap-2">
              <Input
                placeholder="System ID (UUID)"
                value={manualSystemId}
                onChange={(e) => setManualSystemId(e.target.value)}
                className="font-mono text-xs h-8"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleSaveManual} disabled={loadingSave || !manualSystemId.trim()}>
                <Save className="h-3 w-3 mr-1" />
                Salva
              </Button>
            </div>
          </div>

          {/* Reset */}
          {(partner.fiskaly_system_id || partner.fiskaly_entity_id || partner.fiskaly_unit_id) && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={handleReset}
                disabled={loadingReset}
              >
                <RotateCcw className={`h-3 w-3 ${loadingReset ? "animate-spin" : ""}`} />
                Azzera IDs Fiskaly nel DB
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Partner Fiscal Tab ───────────────────────────────────────────────────────
const PartnerFiscalTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "configured" | "not_configured" | "missing_data">("all");

  const { data: partners = [], isLoading, refetch } = useQuery({
    queryKey: ["partnerProfiles"],
    queryFn: fetchPartnerProfiles,
  });

  const handleRefresh = () => { refetch(); };

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.legal_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.vat_number?.includes(q);
    if (!matchSearch) return false;
    if (filter === "all") return true;
    const status = getFiskalyStatus(p);
    if (filter === "configured") return status === "full" || status === "system_ok";
    if (filter === "not_configured") return status === "not_configured";
    if (filter === "missing_data") return status === "missing_data";
    return true;
  });

  const stats = {
    total: partners.length,
    configured: partners.filter((p) => { const s = getFiskalyStatus(p); return s === "full" || s === "system_ok"; }).length,
    notConfigured: partners.filter((p) => getFiskalyStatus(p) === "not_configured").length,
    missingData: partners.filter((p) => getFiskalyStatus(p) === "missing_data").length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Totale partner", value: stats.total, color: "" },
          { label: "Configurati", value: stats.configured, color: "text-primary" },
          { label: "Non configurati", value: stats.notConfigured, color: "text-destructive" },
          { label: "Dati incompleti", value: stats.missingData, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
            <p className={`text-xl font-bold ${color || "text-foreground"}`}>{isLoading ? "–" : value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Cerca partner..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all", "configured", "not_configured", "missing_data"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 text-xs" onClick={() => setFilter(f)}>
              {{ all: "Tutti", configured: "✅ Config.", not_configured: "❌ Non config.", missing_data: "⚠️ Dati" }[f]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Partner list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento partner...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun partner trovato.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PartnerFiscalRow key={p.id} partner={p} onRefresh={handleRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Fiskaly Explorer Tab ────────────────────────────────────────────────────
const FiskalyExplorer = () => {
  const [unitResults, setUnitResults] = useState<FiskalyUnitResult[] | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [decommLoading, setDecommLoading] = useState<string | null>(null);
  const [patchResourceId, setPatchResourceId] = useState("");
  const [patchResource, setPatchResource] = useState<"assets" | "entities" | "systems">("entities");
  const [patchPayload, setPatchPayload] = useState('{"content": {"state": "COMMISSIONED"}}');
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
        toast.success(`${data.total_units} UNIT trovate su Fiskaly (env: ${data.env})`);
      }
    } finally {
      setLoadingUnits(false);
    }
  };

  const handleDecommission = async (entityId: string, unitAssetId: string, entityName: string) => {
    setDecommLoading(entityId);
    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-explorer", {
        body: { action: "decommission_entity", resource: "entities", resource_id: entityId, unit_asset_id: unitAssetId },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Errore decommission");
      } else if (data?.ok || (data?.status >= 200 && data?.status < 300)) {
        toast.success(`Entity "${entityName}" decommissionata ✓`);
        setUnitResults((prev) =>
          prev?.map((u) =>
            u.unit_id === unitAssetId
              ? { ...u, entities: u.entities.map((e) => e.content.id === entityId ? { ...e, content: { ...e.content, state: "DECOMMISSIONED" } } : e) }
              : u
          ) ?? prev
        );
      } else {
        toast.warning(`Fiskaly risposta ${data?.status} — verifica i log`);
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

  // Count entities by state for summary
  const entitySummary = unitResults?.reduce(
    (acc, u) => {
      u.entities.forEach((e) => {
        const s = e.content.state ?? "UNKNOWN";
        acc[s] = (acc[s] ?? 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Interfaccia diretta con le API Fiskaly SIGN IT. I dati sono <strong>fiscalmente immutabili</strong> — non esistono endpoint DELETE.
        Le entità sono visibili solo tramite token scoped alla UNIT di appartenenza.
      </p>

      {/* ── LISTA UNIT + ENTITÀ ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-medium text-sm text-foreground">UNIT Assets e loro Entità</h3>
            {entitySummary && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {Object.entries(entitySummary).map(([state, n]) => `${n} ${state}`).join(" · ")}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={handleLoadUnits} disabled={loadingUnits} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingUnits ? "animate-spin" : ""}`} />
            {loadingUnits ? "Caricamento..." : "Carica da Fiskaly"}
          </Button>
        </div>

        {unitResults !== null && unitResults.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna UNIT trovata.</p>
        )}

        {unitResults && unitResults.map((unit) => {
          const activeEntities = unit.entities.filter((e) => e.content.state !== "DECOMMISSIONED");
          const decommEntities = unit.entities.filter((e) => e.content.state === "DECOMMISSIONED");

          return (
            <div key={unit.unit_id} className="border rounded-lg overflow-hidden">
              {/* UNIT header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{unit.unit_name}</span>
                      <Badge variant="outline" className="text-xs font-mono shrink-0">{unit.unit_state ?? "ENABLED"}</Badge>
                      {unit.unit_metadata?.partner_id && (
                        <span className="text-xs text-muted-foreground">
                          partner: <code className="font-mono">{unit.unit_metadata.partner_id.slice(0, 8)}…</code>
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{unit.unit_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  {activeEntities.length > 0 && <span className="text-primary font-medium">{activeEntities.length} attiva/e</span>}
                  {decommEntities.length > 0 && <span className="text-muted-foreground">{decommEntities.length} decommissionata/e</span>}
                </div>
              </div>

              {/* Entities */}
              {unit.error && <div className="px-4 py-2 text-xs text-destructive">{unit.error}</div>}
              {unit.entities.length === 0 && !unit.error && (
                <div className="px-4 py-2.5 text-xs text-muted-foreground italic">Nessuna entity in questa UNIT.</div>
              )}
              {unit.entities.map((entity) => {
                const eid = entity.content.id;
                const estate = entity.content.state;
                const ename = entity.content.name?.legal ?? entity.content.name?.trade ?? eid;
                const ecity = entity.content.address?.city;
                const ecode = entity.content.address?.code;
                const isDecomm = estate === "DECOMMISSIONED";
                const isLoading = decommLoading === eid;
                const linkedPartnerId = entity.metadata?.partner_id;

                return (
                  <div
                    key={eid}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t text-sm flex-wrap ${isDecomm ? "opacity-40 bg-muted/10" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${isDecomm ? "line-through text-muted-foreground" : ""}`}>{ename}</span>
                          <Badge
                            variant={isDecomm ? "secondary" : estate === "COMMISSIONED" ? "default" : "outline"}
                            className="text-xs shrink-0"
                          >
                            {estate}
                          </Badge>
                          {ecity ? (
                            <span className="text-xs text-muted-foreground">{ecity}{ecode ? `, ${ecode}` : ""}</span>
                          ) : (
                            !isDecomm && <span className="text-xs text-destructive flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />no indirizzo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono text-xs text-muted-foreground">{eid}</code>
                          {linkedPartnerId && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Link2 className="h-3 w-3" />partner: {linkedPartnerId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isDecomm && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1.5 shrink-0"
                        onClick={() => handleDecommission(eid, unit.unit_id, ename)}
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
            <PenLine className="h-4 w-4" /> PATCH manuale
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per operazioni avanzate su entities e systems (es. forzare commissioning). Nota: gli asset UNIT <strong>non supportano</strong> il campo <code className="bg-muted px-1 rounded">state</code>.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <Label className="text-xs">Risorsa</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={patchResource}
                onChange={(e) => setPatchResource(e.target.value as any)}
              >
                <option value="entities">entities</option>
                <option value="systems">systems</option>
                <option value="assets">assets</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs">Resource ID (UUID)</Label>
              <Input
                placeholder="es. 928af8e9-9b66-4734-..."
                value={patchResourceId}
                onChange={(e) => setPatchResourceId(e.target.value)}
                className="font-mono text-sm h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Payload JSON</Label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
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
        <p className="font-medium text-foreground">Limitazioni API Fiskaly SIGN IT (2025-08-12):</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>UNIT Assets</strong>: non supportano il campo <code className="bg-muted px-1 rounded">state</code> via PATCH → non disabilitabili.</li>
          <li><strong>Entities</strong>: visibili solo con token scoped alla UNIT. Non eliminabili — solo decommissionabili.</li>
          <li><strong>Systems</strong>: non eliminabili per legge fiscale italiana.</li>
          <li><strong>DELETE</strong>: nessuna risorsa fiscale è cancellabile.</li>
        </ul>
      </div>
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
const AdminSettings = () => {
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
            Panoramica fiscale dei partner, configurazione automatica e accesso diretto alle API Fiskaly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="partners">
            <TabsList className="mb-6">
              <TabsTrigger value="partners" className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Partner Fiscali
              </TabsTrigger>
              <TabsTrigger value="explorer" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> API Explorer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="partners">
              <PartnerFiscalTab />
            </TabsContent>

            <TabsContent value="explorer">
              <FiskalyExplorer />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AdminErrorLogs />

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
