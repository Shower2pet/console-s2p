import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Zap, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface FiskalySetupCardProps {
  partnerId: string;
  fiskalySystemId?: string | null;
  legalName?: string | null;
  vatNumber?: string | null;
  addressStreet?: string | null;
  zipCode?: string | null;
  city?: string | null;
  province?: string | null;
  /** Query keys to invalidate after success */
  invalidateKeys?: string[][];
}

const REQUIRED_FIELDS = [
  { key: "legalName", label: "Ragione Sociale" },
  { key: "vatNumber", label: "Partita IVA" },
  { key: "addressStreet", label: "Via/Indirizzo" },
  { key: "zipCode", label: "CAP" },
  { key: "city", label: "Città" },
  { key: "province", label: "Provincia" },
] as const;

export const FiskalySetupCard = ({
  partnerId,
  fiskalySystemId,
  legalName,
  vatNumber,
  addressStreet,
  zipCode,
  city,
  province,
  invalidateKeys = [],
}: FiskalySetupCardProps) => {
  const qc = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successSystemId, setSuccessSystemId] = useState<string | null>(null);

  const currentSystemId = successSystemId ?? fiskalySystemId;
  const isConfigured = !!currentSystemId;

  // Check which required fields are missing
  const fieldValues: Record<string, string | null | undefined> = {
    legalName,
    vatNumber,
    addressStreet,
    zipCode,
    city,
    province,
  };
  const missingFields = REQUIRED_FIELDS.filter((f) => !fieldValues[f.key]?.trim());
  const canConfigure = missingFields.length === 0;

  const handleSetup = async (force = false) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: { partner_id: partnerId, force },
      });

      if (error) throw new Error(error.message);

      if (data?.error) {
        setErrorMsg(data.error);
        toast.error("Errore configurazione Fiskaly");
        return;
      }

      if (data?.success) {
        setSuccessSystemId(data.system_id);
        toast.success(
          data.already_configured
            ? "Fiskaly già configurato"
            : "Fiskaly configurato con successo!"
        );
        // Invalidate relevant queries
        invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? "Errore imprevisto");
      toast.error("Errore configurazione Fiskaly");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Configurazione Fiskaly
          {isConfigured ? (
          <Badge variant="outline" className="ml-2 gap-1 border-primary text-primary">
              <CheckCircle2 className="h-3 w-3" /> Configurato
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-2 gap-1 border-destructive text-destructive">
              <AlertCircle className="h-3 w-3" /> Non configurato
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">System ID (TSS)</p>
              <p className="font-mono text-sm text-foreground bg-muted rounded px-3 py-2 break-all">
                {currentSystemId}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetup(true)}
              disabled={isLoading}
              className="gap-2 text-muted-foreground"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Riconfigura (force)
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Crea automaticamente l'Entity e il System su Fiskaly SIGN IT partendo dai dati fiscali del partner.
            </p>

            {!canConfigure && (
              <div className="rounded-lg bg-muted border border-border px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Dati obbligatori mancanti:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {missingFields.map((f) => (
                    <li key={f.key}>{f.label}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-1">
                  Compila i campi mancanti e salva prima di procedere.
                </p>
              </div>
            )}

            <Button
              onClick={() => handleSetup(false)}
              disabled={isLoading || !canConfigure}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrazione in corso su Fiskaly...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Configura automaticamente su Fiskaly
                </>
              )}
            </Button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm font-medium text-destructive mb-1">Errore:</p>
            <p className="text-sm text-destructive/90">{errorMsg}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
