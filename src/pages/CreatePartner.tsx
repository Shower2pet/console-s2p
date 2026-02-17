import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2, Copy, Check, Monitor, ArrowLeft, Search,
  ArrowUpDown, CheckSquare, Square, UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchFreeStations, type FreeStation } from "@/services/stationService";
import { inviteUser } from "@/services/userService";

const inviteSchema = z.object({
  legalName: z.string().trim().min(1, "Ragione Sociale obbligatoria").max(100),
  vatNumber: z.string().trim().min(1, "Partita IVA obbligatoria").max(20),
  email: z.string().trim().email("Email non valida").max(255),
});

type InviteFormValues = z.infer<typeof inviteSchema>;


type SortField = "id" | "type";
type SortDir = "asc" | "desc";

const CreatePartner = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Stations
  const [freeStations, setFreeStations] = useState<FreeStation[]>([]);
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [stationSearch, setStationSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { legalName: "", vatNumber: "", email: "" },
  });

  useEffect(() => {
    fetchFreeStations()
      .then((data) => setFreeStations(data))
      .catch(() => toast.error("Errore caricamento stazioni"))
      .finally(() => setLoadingStations(false));
  }, []);

  const toggleStation = (id: string) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedStationIds.length === filteredStations.length) {
      setSelectedStationIds([]);
    } else {
      setSelectedStationIds(filteredStations.map((s) => s.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredStations = useMemo(() => {
    const q = stationSearch.toLowerCase();
    let list = freeStations.filter(
      (s) =>
        String(s.id).toLowerCase().includes(q) ||
        String(s.type).toLowerCase().includes(q) ||
        String(s.type).toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      const aVal = (a[sortField] ?? "").toString().toLowerCase();
      const bVal = (b[sortField] ?? "").toString().toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [freeStations, stationSearch, sortField, sortDir]);

  const onSubmit = async (values: InviteFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await inviteUser({
        email: values.email,
        firstName: values.legalName,
        lastName: "",
        role: "partner",
        stationIds: selectedStationIds.length > 0 ? selectedStationIds : undefined,
      });
      setCreatedUser({ email: values.email, password: result.tempPassword });
      reset();
    } catch (err: any) {
      toast.error(err.message ?? "Impossibile creare l'utente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdUser) return;
    const text = `Email: ${createdUser.email}\nPassword: ${createdUser.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : ""}`} />
    </button>
  );

  // Success view
  if (createdUser) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" /> Partner Creato con Successo
            </CardTitle>
            <CardDescription>
              Comunica queste credenziali al nuovo partner. La password è temporanea.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-mono text-sm font-medium text-foreground">{createdUser.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Password Temporanea</Label>
                <p className="font-mono text-sm font-medium text-foreground">{createdUser.password}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiato!" : "Copia Credenziali"}
              </Button>
              <Button onClick={() => navigate("/clients")}>Torna ai Clienti</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> Nuovo Partner
          </h1>
          <p className="text-muted-foreground">Inserisci i dati e assegna le stazioni dal magazzino</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Partner data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Partner</CardTitle>
              <CardDescription>Informazioni di base per l'account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Ragione Sociale *</Label>
                  <Input id="legalName" placeholder="Azienda Srl" {...register("legalName")} />
                  {errors.legalName && <p className="text-xs text-destructive">{errors.legalName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">Partita IVA *</Label>
                  <Input id="vatNumber" placeholder="01234567890" {...register("vatNumber")} />
                  {errors.vatNumber && <p className="text-xs text-destructive">{errors.vatNumber.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="mario@esempio.it" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Right: Station selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" /> Stazioni da Assegnare
                  </CardTitle>
                  <CardDescription>
                    {freeStations.length} stazioni libere nel magazzino
                  </CardDescription>
                </div>
                {selectedStationIds.length > 0 && (
                  <Badge variant="default">{selectedStationIds.length} selezionate</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search + Select all */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per ID, tipo, categoria..."
                    className="pl-10"
                    value={stationSearch}
                    onChange={(e) => setStationSearch(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="gap-1 shrink-0"
                >
                  {selectedStationIds.length === filteredStations.length && filteredStations.length > 0 ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Tutti
                </Button>
              </div>

              {/* Station table */}
              {loadingStations ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : freeStations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nessuna stazione libera disponibile nel magazzino.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                         <tr className="border-b text-left text-xs">
                           <th className="p-3 w-10"></th>
                           <th className="p-3"><SortButton field="id" label="ID" /></th>
                           <th className="p-3"><SortButton field="type" label="Tipo" /></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {filteredStations.map((s) => {
                          const isSelected = selectedStationIds.includes(s.id);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => toggleStation(s.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : "hover:bg-accent/50"
                              }`}
                            >
                              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={isSelected} onCheckedChange={() => toggleStation(s.id)} />
                              </td>
                              <td className="p-3 font-medium text-foreground">{String(s.id)}</td>
                              <td className="p-3 text-muted-foreground capitalize">{String(s.type ?? "")}</td>
                            </tr>
                          );
                        })}
                         {filteredStations.length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">
                              Nessuna stazione trovata per "{stationSearch}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-6">
          <Button type="button" variant="outline" onClick={() => navigate("/clients")} className="mr-2">
            Annulla
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <UserPlus className="h-4 w-4" />
            Crea Partner
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreatePartner;
