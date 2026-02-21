import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Zap, RefreshCw, Eye, EyeOff, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Fisconline credentials + CF rappresentante legale (not saved)
  const [fisconlinePassword, setFisconlinePassword] = useState("");
  const [fisconlinePin, setFisconlinePin] = useState("");
  const [legalRepFiscalCode, setLegalRepFiscalCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const currentSystemId = successSystemId ?? fiskalySystemId;
  const isConfigured = !!currentSystemId;

  const fieldValues: Record<string, string | null | undefined> = {
    legalName, vatNumber, addressStreet, zipCode, city, province,
  };
  const missingFields = REQUIRED_FIELDS.filter((f) => !fieldValues[f.key]?.trim());
  const hasFisconline = fisconlinePassword.trim().length > 0 && fisconlinePin.trim().length > 0;
  const legalRepCfValid = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(legalRepFiscalCode.trim());
  const canConfigure = missingFields.length === 0 && hasFisconline && legalRepCfValid;

  const handleSetup = async (force = false) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("fiskaly-setup", {
        body: {
          partner_id: partnerId,
          force,
          fisconline_password: fisconlinePassword,
          fisconline_pin: fisconlinePin,
          legal_rep_fiscal_code: legalRepFiscalCode.trim().toUpperCase(),
        },
      });

      if (error) {
        let msg = error.message ?? "Errore imprevisto";
        try {
          const ctx = (error as any).context;
          if (ctx) {
            const bodyText = typeof ctx === "string" ? ctx : await ctx.text?.();
            const parsed = JSON.parse(bodyText ?? "{}");
            if (parsed?.error) msg = parsed.error;
            if (parsed?.details) {
              try {
                const details = typeof parsed.details === "string" ? JSON.parse(parsed.details) : parsed.details;
                if (details?.content?.message) msg += ` — ${details.content.message}`;
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
        setErrorMsg(msg);
        toast.error("Errore configurazione Fiskaly");
        return;
      }

      if (data?.error) {
        setErrorMsg(data.error);
        toast.error("Errore configurazione Fiskaly");
        return;
      }

      if (data?.success) {
        setSuccessSystemId(data.system_id);
        setFisconlinePassword("");
        setFisconlinePin("");
        setLegalRepFiscalCode("");
        toast.success(
          data.already_configured
            ? "Fiskaly già configurato"
            : "Fiskaly configurato con successo!"
        );
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

            <FisconlineFields
              password={fisconlinePassword}
              pin={fisconlinePin}
              legalRepFiscalCode={legalRepFiscalCode}
              legalRepCfValid={legalRepCfValid}
              showPassword={showPassword}
              showPin={showPin}
              onPasswordChange={setFisconlinePassword}
              onPinChange={setFisconlinePin}
              onLegalRepFcChange={setLegalRepFiscalCode}
              onTogglePassword={() => setShowPassword(!showPassword)}
              onTogglePin={() => setShowPin(!showPin)}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSetup(true)}
              disabled={isLoading || !hasFisconline || !legalRepCfValid}
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea automaticamente l'Entity e il System su Fiskaly SIGN IT partendo dai dati fiscali del partner.
            </p>

            {missingFields.length > 0 && (
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

            <FisconlineFields
              password={fisconlinePassword}
              pin={fisconlinePin}
              legalRepFiscalCode={legalRepFiscalCode}
              legalRepCfValid={legalRepCfValid}
              showPassword={showPassword}
              showPin={showPin}
              onPasswordChange={setFisconlinePassword}
              onPinChange={setFisconlinePin}
              onLegalRepFcChange={setLegalRepFiscalCode}
              onTogglePassword={() => setShowPassword(!showPassword)}
              onTogglePin={() => setShowPin(!showPin)}
            />

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

/** Fisconline password + PIN + CF rappresentante legale fields */
function FisconlineFields({
  password, pin, legalRepFiscalCode, legalRepCfValid,
  showPassword, showPin,
  onPasswordChange, onPinChange, onLegalRepFcChange,
  onTogglePassword, onTogglePin,
}: {
  password: string; pin: string;
  legalRepFiscalCode: string; legalRepCfValid: boolean;
  showPassword: boolean; showPin: boolean;
  onPasswordChange: (v: string) => void; onPinChange: (v: string) => void;
  onLegalRepFcChange: (v: string) => void;
  onTogglePassword: () => void; onTogglePin: () => void;
}) {
  const cfTouched = legalRepFiscalCode.length > 0;
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground mb-1">Credenziali Fisconline (Agenzia delle Entrate)</p>
        <p className="text-xs text-muted-foreground">
          Necessarie per l'invio telematico dei corrispettivi. Scadono ogni 60 giorni.
          Non vengono salvate nel database.
        </p>
      </div>

      {/* CF Rappresentante Legale */}
      <div className="space-y-1.5">
        <Label htmlFor="legal-rep-fc" className="text-xs">Codice Fiscale del Rappresentante Legale</Label>
        <Input
          id="legal-rep-fc"
          value={legalRepFiscalCode}
          onChange={(e) => onLegalRepFcChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="Es. RSSMRA85M01H501Z"
          maxLength={16}
          className={cfTouched && !legalRepCfValid ? "border-destructive" : ""}
        />
        <div className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Il CF personale (16 caratteri) di chi detiene le credenziali Fisconline. 
            È diverso dal CF aziendale (che coincide con la P.IVA).
          </p>
        </div>
        {cfTouched && !legalRepCfValid && (
          <p className="text-xs text-destructive">Formato non valido — deve essere 16 caratteri alfanumerici (es. RSSMRA85M01H501Z)</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fisconline-password" className="text-xs">Password Fisconline</Label>
          <div className="relative">
            <Input
              id="fisconline-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fisconline-pin" className="text-xs">PIN Fisconline</Label>
          <div className="relative">
            <Input
              id="fisconline-pin"
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="PIN"
              className="pr-10"
            />
            <button
              type="button"
              onClick={onTogglePin}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
