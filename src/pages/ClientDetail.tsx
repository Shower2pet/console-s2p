import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Monitor, Loader2, Mail, Trash2, MapPin, Briefcase, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import DeletePartnerDialog from "@/components/DeletePartnerDialog";
import StaticMapPreview from "@/components/StaticMapPreview";
import AssignStationDialog from "@/components/AssignStationDialog";
import { fetchProfileById, updatePartnerData } from "@/services/profileService";
import { fetchStructuresByOwner } from "@/services/structureService";
import { fetchStationsByOwner } from "@/services/stationService";
import { deleteUser } from "@/services/userService";
import { FiskalySetupCard } from "@/components/FiskalySetupCard";

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["client-profile", id],
    enabled: !!id,
    queryFn: () => fetchProfileById(id!),
  });

  const { data: structures, isLoading: structLoading } = useQuery({
    queryKey: ["client-structures", id],
    enabled: !!id,
    queryFn: () => fetchStructuresByOwner(id!),
  });

  const { data: stations } = useQuery({
    queryKey: ["client-stations-all", id],
    enabled: !!id,
    queryFn: () => fetchStationsByOwner(id!),
  });

  if (profileLoading || structLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <div className="p-6 text-muted-foreground">Cliente non trovato.</div>;

  const displayName = profile.legal_name || profile.email || "—";

  const handleDeletePartner = async () => {
    try {
      await deleteUser(id!);
      toast.success("Partner eliminato con successo");
      navigate("/clients");
    } catch (err: any) {
      handleAppError(err, "ClientDetail: eliminazione partner");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clients" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{displayName}</h1>
            <p className="text-muted-foreground capitalize">{profile.role ?? "user"}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Elimina Partner
        </Button>
      </div>

      <DeletePartnerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        partnerName={displayName}
        onConfirm={handleDeletePartner}
      />

      {/* Partner business info - editable by admin */}
      <PartnerInfoCard profileId={id!} profile={profile} />

      {/* Fiskaly configuration */}
      <FiskalySetupCard
        partnerId={id!}
        fiskalySystemId={profile.fiskaly_system_id}
        legalName={profile.legal_name}
        vatNumber={profile.vat_number}
        legalRepFiscalCode={(profile as any).legal_rep_fiscal_code}
        addressStreet={profile.address_street}
        zipCode={profile.zip_code}
        city={profile.city}
        province={profile.province}
        invalidateKeys={[["client-profile", id!]]}
        isAdmin
      />

      {/* Structures */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Strutture ({(structures ?? []).length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(structures ?? []).map((s) => (
            <Link key={s.id} to={`/structures/${s.id}`}>
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
              <StaticMapPreview lat={s.geo_lat} lng={s.geo_lng} height="100px" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.address}
                  </p>
                )}
              </CardContent>
            </Card>
            </Link>
          ))}
          {(structures ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna struttura.</p>
          )}
        </div>
      </div>

      {/* Stations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> Stazioni ({(stations ?? []).length})
          </h2>
          <AssignStationDialog partnerId={id!} partnerName={displayName} prominent />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(stations ?? []).map((s) => (
            <Link key={s.id} to={`/stations/${s.id}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-heading">{s.id}</CardTitle>
                    <StatusBadge status={s.status ?? "OFFLINE"} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Struttura: {(s as any).structures?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(stations ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-4">Nessuna stazione.</p>
          )}
        </div>
      </div>
    </div>
  );
};

/** Editable partner info card for admin */
const PartnerInfoCard = ({ profileId, profile }: { profileId: string; profile: any }) => {
  const qc = useQueryClient();
  const [legalName, setLegalName] = useState(profile.legal_name ?? "");
  const [vatNumber, setVatNumber] = useState(profile.vat_number ?? "");
  const [fiscalCode, setFiscalCode] = useState(profile.fiscal_code ?? "");
  const [legalRepFiscalCode, setLegalRepFiscalCode] = useState((profile as any).legal_rep_fiscal_code ?? "");
  const [fiskalySystemId, setFiskalySystemId] = useState(profile.fiskaly_system_id ?? "");
  const [addressStreet, setAddressStreet] = useState(profile.address_street ?? "");
  const [addressNumber, setAddressNumber] = useState(profile.address_number ?? "");
  const [zipCode, setZipCode] = useState(profile.zip_code ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [province, setProvince] = useState(profile.province ?? "");

  // Validation
  const vatValid = !vatNumber.trim() || /^\d{11}$/.test(vatNumber.trim());
  const fiscalCodeValid = !fiscalCode.trim() || /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(fiscalCode.trim()) || /^\d{11}$/.test(fiscalCode.trim());
  const legalRepFcValid = !legalRepFiscalCode.trim() || /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(legalRepFiscalCode.trim());
  const zipValid = !zipCode.trim() || /^\d{5}$/.test(zipCode.trim());
  const provinceValid = !province.trim() || /^[A-Z]{2}$/i.test(province.trim());
  const formValid = !!legalName.trim() && !!vatNumber.trim() && vatValid && fiscalCodeValid && legalRepFcValid && zipValid && provinceValid;

  const saveMutation = useMutation({
    mutationFn: () =>
      updatePartnerData(profileId, {
        legal_name: legalName.trim() || null,
        vat_number: vatNumber.trim() || null,
        fiscal_code: fiscalCode.trim() || null,
        legal_rep_fiscal_code: legalRepFiscalCode.trim().toUpperCase() || null,
        fiskaly_system_id: fiskalySystemId.trim() || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        zip_code: zipCode.trim() || null,
        city: city.trim() || null,
        province: province.trim().toUpperCase() || null,
      }),
    onSuccess: () => {
      toast.success("Dati partner salvati");
      qc.invalidateQueries({ queryKey: ["client-profile", profileId] });
    },
    onError: (e: any) => handleAppError(e, "ClientDetail: salvataggio dati partner"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" /> Informazioni Aziendali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{profile.email ?? "—"}</span>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <div>
            <Label>Fiskaly System ID</Label>
            <Input value={fiskalySystemId} onChange={(e) => setFiskalySystemId(e.target.value)} className="mt-1.5 font-mono text-sm" placeholder="ID sistema Fiskaly" />
            <p className="text-xs text-muted-foreground mt-1">Necessario per l'invio dei corrispettivi elettronici</p>
          </div>
          <div>
            <Label>Ragione Sociale *</Label>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Partita IVA *</Label>
              <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value.replace(/\D/g, "").slice(0, 11))} className="mt-1.5" maxLength={11} placeholder="11 cifre" />
              {vatNumber.trim() && !vatValid && <p className="text-xs text-destructive mt-1">Deve essere di 11 cifre numeriche</p>}
            </div>
            <div>
              <Label>Codice Fiscale Aziendale</Label>
              <Input value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value.toUpperCase().slice(0, 16))} className="mt-1.5" placeholder={vatNumber.trim() || "Uguale alla P.IVA"} maxLength={16} />
              {fiscalCode.trim() && !fiscalCodeValid && <p className="text-xs text-destructive mt-1">Formato non valido (16 caratteri o 11 cifre)</p>}
            </div>
          </div>
          <div>
            <Label>CF Rappresentante Legale</Label>
            <Input value={legalRepFiscalCode} onChange={(e) => setLegalRepFiscalCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))} className="mt-1.5" placeholder="Es. RSSMRA85M01H501Z" maxLength={16} />
            {legalRepFiscalCode.trim() && !legalRepFcValid && <p className="text-xs text-destructive mt-1">Deve essere 16 caratteri alfanumerici</p>}
            <p className="text-xs text-muted-foreground mt-1">CF personale di chi detiene le credenziali Fisconline (obbligatorio per Fiskaly)</p>
          </div>

          <p className="text-sm font-medium text-foreground">Sede Legale</p>
          <div className="grid sm:grid-cols-[1fr_auto] gap-4">
            <div>
              <Label>Via / Indirizzo</Label>
              <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>N. Civico</Label>
              <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} className="mt-1.5 w-24" />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>CAP</Label>
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))} className="mt-1.5" maxLength={5} />
              {zipCode.trim() && !zipValid && <p className="text-xs text-destructive mt-1">Deve essere di 5 cifre</p>}
            </div>
            <div>
              <Label>Città</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Provincia</Label>
              <Input value={province} onChange={(e) => setProvince(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} className="mt-1.5" maxLength={2} />
              {province.trim() && !provinceValid && <p className="text-xs text-destructive mt-1">2 lettere (es. RM)</p>}
            </div>
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formValid} className="gap-2">
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" /> Salva Dati Partner
        </Button>
      </CardContent>
    </Card>
  );
};

export default ClientDetail;
