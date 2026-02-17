import { useState, useEffect } from "react";
import { FileText, Save, Loader2, Plus, Trash2, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updatePartnerData } from "@/services/profileService";
import {
  fetchSubscriptionPlans,
  createSubscriptionPlan,
  deactivateSubscriptionPlan,
} from "@/services/subscriptionPlanService";

const Settings = () => {
  const { user, role, profile } = useAuth();
  const qc = useQueryClient();

  // Partner fields
  const [legalName, setLegalName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [fiskalySystemId, setFiskalySystemId] = useState("");

  useEffect(() => {
    if (profile) {
      setLegalName(profile.legal_name ?? "");
      setVatNumber(profile.vat_number ?? "");
      setFiscalCode(profile.fiscal_code ?? "");
      setAddressStreet((profile as any).address_street ?? "");
      setAddressNumber((profile as any).address_number ?? "");
      setZipCode((profile as any).zip_code ?? "");
      setCity((profile as any).city ?? "");
      setProvince((profile as any).province ?? "");
      setFiskalySystemId(profile.fiskaly_system_id ?? "");
    }
  }, [profile]);

  const effectiveFiscalCode = fiscalCode.trim() || vatNumber.trim();

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePartnerData(user!.id, {
        legal_name: legalName.trim() || null,
        vat_number: vatNumber.trim() || null,
        fiscal_code: effectiveFiscalCode || null,
        fiskaly_system_id: fiskalySystemId.trim() || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        zip_code: zipCode.trim() || null,
        city: city.trim() || null,
        province: province.trim().toUpperCase() || null,
      }),
    onSuccess: () => {
      toast.success("Dati aziendali salvati");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <FileText className="inline mr-2 h-6 w-6 text-primary" />
          {role === "partner" ? "Profilo Aziendale" : "Impostazioni"}
        </h1>
        <p className="text-muted-foreground">Gestisci i dati aziendali e fiscali</p>
      </div>

      {(role === "partner" || role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Dati Aziendali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Ragione Sociale *</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1.5" placeholder="Obbligatorio" />
              {!legalName.trim() && <p className="text-xs text-destructive mt-1">Campo obbligatorio</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Partita IVA *</Label>
                <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} className="mt-1.5" placeholder="Obbligatorio" />
                {!vatNumber.trim() && <p className="text-xs text-destructive mt-1">Campo obbligatorio</p>}
              </div>
              <div>
                <Label>Codice Fiscale</Label>
                <Input value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value)} className="mt-1.5" placeholder={vatNumber.trim() || "Uguale alla P.IVA se vuoto"} />
                <p className="text-xs text-muted-foreground mt-1">Se vuoto, verrà usata la Partita IVA</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Sede Legale</p>
              <div className="grid sm:grid-cols-[1fr_auto] gap-4">
                <div>
                  <Label>Via / Indirizzo *</Label>
                  <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="mt-1.5" placeholder="Via Roma" />
                </div>
                <div>
                  <Label>N. Civico</Label>
                  <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} className="mt-1.5 w-24" placeholder="12/A" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label>CAP *</Label>
                  <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="mt-1.5" placeholder="00100" maxLength={5} />
                </div>
                <div>
                  <Label>Città *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" placeholder="Roma" />
                </div>
                <div>
                  <Label>Provincia *</Label>
                  <Input value={province} onChange={(e) => setProvince(e.target.value.toUpperCase())} className="mt-1.5" placeholder="RM" maxLength={2} />
                </div>
              </div>
            </div>

            {(role === "admin" || role === "partner") && (
              <div className="border-t border-border pt-4">
                <Label>Fiskaly System ID</Label>
                <Input value={fiskalySystemId} onChange={(e) => setFiskalySystemId(e.target.value)} className="mt-1.5 font-mono text-sm" placeholder="ID sistema Fiskaly" />
                <p className="text-xs text-muted-foreground mt-1">Necessario per l'invio dei corrispettivi elettronici</p>
              </div>
            )}

            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !legalName.trim() || !vatNumber.trim()}
              className="gap-2"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" /> Salva
            </Button>
          </CardContent>
        </Card>
      )}

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
    queryFn: () => fetchSubscriptionPlans(userId),
  });

  const createPlan = useMutation({
    mutationFn: () =>
      createSubscriptionPlan({
        owner_id: userId,
        name: newName.trim(),
        price_eur: parseFloat(newPrice),
        interval: newInterval,
        max_washes_per_month: newMaxWashes ? parseInt(newMaxWashes) : null,
      }),
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
    mutationFn: deactivateSubscriptionPlan,
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
