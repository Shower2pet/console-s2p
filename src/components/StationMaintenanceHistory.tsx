import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";

interface Props {
  stationId: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aperto", variant: "destructive" },
  in_progress: { label: "In corso", variant: "default" },
  risolto: { label: "Risolto", variant: "secondary" },
};

const severityMap: Record<string, { label: string; className: string }> = {
  low: { label: "Bassa", className: "text-muted-foreground" },
  medium: { label: "Media", className: "text-warning-foreground" },
  high: { label: "Alta", className: "text-destructive font-semibold" },
};

const StationMaintenanceHistory = ({ stationId }: Props) => {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["station-maintenance-history", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_logs")
        .select("id, status, severity, reason, created_at, ended_at, performed_by, notes")
        .eq("station_id", stationId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" /> Storico Manutenzione
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">Nessun ticket di manutenzione.</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Gravità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Chiuso il</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => {
                  const st = statusMap[t.status ?? ""] ?? { label: t.status, variant: "outline" as const };
                  const sev = severityMap[t.severity ?? ""] ?? { label: t.severity, className: "" };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(t.created_at!), "dd MMM yyyy HH:mm", { locale: it })}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        <Link to={`/maintenance/${t.id}`} className="text-primary hover:underline">
                          {t.reason || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className={`text-xs ${sev.className}`}>{sev.label}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {t.ended_at ? format(new Date(t.ended_at), "dd MMM yyyy", { locale: it }) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default StationMaintenanceHistory;
