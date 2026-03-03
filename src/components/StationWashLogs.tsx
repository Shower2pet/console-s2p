import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Droplets } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  stationId: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Attiva", variant: "default" },
  COMPLETED: { label: "Completata", variant: "secondary" },
  EXPIRED: { label: "Scaduta", variant: "outline" },
  CANCELLED: { label: "Annullata", variant: "destructive" },
};

const StationWashLogs = ({ stationId }: Props) => {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["station-wash-logs", stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wash_sessions")
        .select("id, status, option_name, started_at, ends_at, total_seconds, guest_email, user_id")
        .eq("station_id", stationId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Fetch user emails for registered users
      const userIds = [...new Set((data ?? []).map(d => d.user_id).filter(Boolean))] as string[];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        (profiles ?? []).forEach(p => profileMap.set(p.id, p.email ?? ""));
      }

      return (data ?? []).map(s => ({
        ...s,
        user_email: s.user_id ? profileMap.get(s.user_id) ?? null : s.guest_email ?? null,
      }));
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" /> Storico Utilizzi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">Nessun utilizzo registrato.</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Opzione</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const st = statusMap[s.status] ?? { label: s.status, variant: "outline" as const };
                  const durationMin = Math.round(s.total_seconds / 60);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(s.started_at), "dd MMM yyyy HH:mm", { locale: it })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{s.option_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {s.user_email || <span className="italic">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{durationMin} min</TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
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

export default StationWashLogs;
