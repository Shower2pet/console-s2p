import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, ShowerHead, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";


interface StationUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_guest: boolean;
  total_washes: number;
  last_wash_at: string | null;
}

const fetchStationUsers = async (stationId: string): Promise<StationUser[]> => {
  const { data, error } = await (supabase.rpc as any)("get_station_users", {
    p_station_id: stationId,
    p_search: "",
  });
  if (error) throw error;
  return (data ?? []) as StationUser[];
};

const StationUsersList = ({ stationId }: { stationId: string }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useQuery({
    queryKey: ["station-users", stationId],
    queryFn: () => fetchStationUsers(stationId),
  });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = users ?? [];
    if (!term) return source;

    return source.filter((u) => {
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
      return (
        fullName.includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.phone ?? "").toLowerCase().includes(term)
      );
    });
  }, [users, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Utenti ({isLoading ? "…" : list.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, email, telefono..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun utente ha effettuato lavaggi su questa stazione.</p>
        )}

        {/* Mobile cards */}
        <div className="space-y-2 sm:hidden">
          {list.map((u) => {
            const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "—";
            const initials = displayName.charAt(0).toUpperCase();
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/end-users/${u.id}`)}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    {u.is_guest && (
                      <span className="rounded-md bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">Guest</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><ShowerHead className="h-3 w-3" /> {u.total_washes}</span>
                    {u.last_wash_at && <span>Ultimo: {new Date(u.last_wash_at).toLocaleDateString("it-IT")}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        {list.length > 0 && (
          <div className="hidden sm:block overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Tipo</th>
                  <th className="p-3 font-medium">Lavaggi</th>
                  <th className="p-3 font-medium">Ultimo lavaggio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((u) => {
                  const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                  const initials = displayName.charAt(0).toUpperCase();
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/end-users/${u.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {initials}
                          </div>
                          <span className="font-medium text-foreground truncate">{displayName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-[180px]">{u.email ?? "—"}</td>
                      <td className="p-3">
                        {u.is_guest ? (
                          <span className="rounded-md bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">Guest</span>
                        ) : (
                          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Registrato</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1">
                          <ShowerHead className="h-3.5 w-3.5 text-muted-foreground" /> {u.total_washes}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {u.last_wash_at ? new Date(u.last_wash_at).toLocaleDateString("it-IT") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StationUsersList;
