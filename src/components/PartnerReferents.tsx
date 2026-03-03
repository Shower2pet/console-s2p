import { useState } from "react";
import { Users, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";

interface Referent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

const fetchReferents = async (partnerId: string): Promise<Referent[]> => {
  const { data, error } = await supabase
    .from("partner_referents" as any)
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any;
};

interface Props {
  partnerId: string;
}

const PartnerReferents = ({ partnerId }: Props) => {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canAdd = !!firstName.trim() && !!lastName.trim() && !!email.trim() && emailValid;

  const { data: referents, isLoading } = useQuery({
    queryKey: ["partner-referents", partnerId],
    queryFn: () => fetchReferents(partnerId),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("partner_referents")
        .insert({
          partner_id: partnerId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referente aggiunto");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      qc.invalidateQueries({ queryKey: ["partner-referents"] });
    },
    onError: (e: any) => handleAppError(e, "PartnerReferents: aggiunta referente"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("partner_referents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Referente rimosso");
      qc.invalidateQueries({ queryKey: ["partner-referents"] });
    },
    onError: (e: any) => handleAppError(e, "PartnerReferents: rimozione referente"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Referenti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {(referents ?? []).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.email}
                    {r.phone && ` • ${r.phone}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(r.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {(referents ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessun referente aggiunto.
              </p>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Nuovo Referente</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Mario"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-xs">Cognome *</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rossi"
                    className="mt-1"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mario@azienda.it"
                    className="mt-1"
                    maxLength={255}
                  />
                  {email.trim() && !emailValid && (
                    <p className="text-xs text-destructive mt-1">Email non valida</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Telefono (opz.)</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+39 333 1234567"
                    className="mt-1"
                    maxLength={30}
                  />
                </div>
              </div>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !canAdd}
                className="gap-2"
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Aggiungi Referente
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerReferents;
