import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Monitor, Loader2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStructure } from "@/hooks/useStructures";
import { useStations } from "@/hooks/useStations";
import { StatusBadge } from "@/components/StatusBadge";

const StructureDetail = () => {
  const { id } = useParams();
  const { data: structure, isLoading } = useStructure(id);
  const { data: stations, isLoading: stLoading } = useStations(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!structure) return <div className="p-6 text-muted-foreground">Struttura non trovata.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/structures" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{structure.name}</h1>
          {structure.address && <p className="text-muted-foreground">{structure.address}</p>}
        </div>
      </div>

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations" className="gap-2"><Monitor className="h-4 w-4" /> Macchine</TabsTrigger>
          <TabsTrigger value="packages" className="gap-2"><Package className="h-4 w-4" /> Prodotti</TabsTrigger>
        </TabsList>

        <TabsContent value="stations" className="mt-4">
          {stLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
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
                      <p className="text-xs text-muted-foreground capitalize">Tipo: {s.type}</p>
                      {s.category && <p className="text-xs text-muted-foreground">Categoria: {s.category}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(stations ?? []).length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Nessuna stazione collegata.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          <p className="text-muted-foreground text-sm">Gestione pacchetti crediti — in arrivo nella Fase 3.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StructureDetail;
