import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Building2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingStation {
  id: string;
  type: string;
  category: string | null;
}

interface NewStructure {
  name: string;
  address: string;
  stationIds: string[];
}

const Onboarding = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"password" | "structures">("password");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Structures step
  const [pendingStations, setPendingStations] = useState<PendingStation[]>([]);
  const [structures, setStructures] = useState<NewStructure[]>([{ name: "", address: "", stationIds: [] }]);
  const [loadingStations, setLoadingStations] = useState(false);

  useEffect(() => {
    if (step === "structures" && user) {
      setLoadingStations(true);
      supabase
        .from("stations")
        .select("id, type, category")
        .eq("owner_id", user.id)
        .is("structure_id", null)
        .then(({ data }) => {
          setPendingStations((data ?? []) as PendingStation[]);
          setLoadingStations(false);
        });
    }
  }, [step, user]);

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Le password non coincidono");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    // Clear must_change_password flag
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", user!.id);
    toast.success("Password aggiornata!");

    // If partner, go to structures step; otherwise finish
    if (profile?.role === "partner") {
      setStep("structures");
    } else {
      navigate("/", { replace: true });
    }
    setSaving(false);
  };

  const addStructure = () => {
    setStructures([...structures, { name: "", address: "", stationIds: [] }]);
  };

  const removeStructure = (idx: number) => {
    if (structures.length <= 1) return;
    setStructures(structures.filter((_, i) => i !== idx));
  };

  const updateStructure = (idx: number, field: keyof NewStructure, value: any) => {
    setStructures(structures.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const toggleStationForStructure = (structIdx: number, stationId: string) => {
    // Remove from any other structure first
    const updated = structures.map((s, i) => ({
      ...s,
      stationIds: i === structIdx
        ? (s.stationIds.includes(stationId) ? s.stationIds.filter((id) => id !== stationId) : [...s.stationIds, stationId])
        : s.stationIds.filter((id) => id !== stationId),
    }));
    setStructures(updated);
  };

  const assignedStationIds = structures.flatMap((s) => s.stationIds);

  const handleCreateStructures = async () => {
    const valid = structures.filter((s) => s.name.trim());
    if (valid.length === 0) {
      toast.error("Inserisci almeno il nome di una struttura");
      return;
    }
    setSaving(true);
    try {
      for (const s of valid) {
        const { data: created, error } = await supabase
          .from("structures")
          .insert({ name: s.name.trim(), address: s.address.trim() || null, owner_id: user!.id })
          .select()
          .single();
        if (error) throw error;

        // Assign stations to this structure
        if (s.stationIds.length > 0) {
          const { error: stErr } = await supabase
            .from("stations")
            .update({ structure_id: created.id })
            .in("id", s.stationIds);
          if (stErr) console.error("Station assign error:", stErr);
        }
      }
      toast.success("Strutture create con successo!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Errore durante la creazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground">Benvenuto in Shower2Pet 🐾</h1>
          <p className="text-muted-foreground mt-1">Completa la configurazione del tuo account</p>
        </div>

        {step === "password" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Cambia Password
              </CardTitle>
              <CardDescription>Per motivi di sicurezza, imposta una nuova password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nuova Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5" placeholder="Almeno 6 caratteri" />
              </div>
              <div>
                <Label>Conferma Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1.5" placeholder="Ripeti la password" />
              </div>
              <Button onClick={handlePasswordChange} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Aggiorna Password
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "structures" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Crea le tue Strutture
              </CardTitle>
              <CardDescription>
                Organizza le tue stazioni in strutture (es. sedi, punti vendita).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {structures.map((s, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Struttura {idx + 1}</Label>
                    {structures.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeStructure(idx)} className="text-destructive h-7 px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input placeholder="Nome struttura" value={s.name} onChange={(e) => updateStructure(idx, "name", e.target.value)} />
                  <Input placeholder="Indirizzo (opzionale)" value={s.address} onChange={(e) => updateStructure(idx, "address", e.target.value)} />

                  {/* Station assignment */}
                  {pendingStations.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Assegna stazioni:</Label>
                      <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {pendingStations.map((st) => {
                          const isAssigned = s.stationIds.includes(st.id);
                          const assignedElsewhere = !isAssigned && assignedStationIds.includes(st.id);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center gap-2 rounded p-1.5 text-xs cursor-pointer transition-colors ${assignedElsewhere ? "opacity-40" : "hover:bg-accent/50"}`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                disabled={assignedElsewhere}
                                onChange={() => toggleStationForStructure(idx, st.id)}
                                className="rounded"
                              />
                              <span className="font-medium">{st.id}</span>
                              <span className="text-muted-foreground capitalize">{st.type}{st.category ? ` • ${st.category}` : ""}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addStructure} className="w-full gap-2">
                <Plus className="h-4 w-4" /> Aggiungi Struttura
              </Button>

              <Button onClick={handleCreateStructures} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Completa Configurazione
              </Button>

              {loadingStations && (
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
