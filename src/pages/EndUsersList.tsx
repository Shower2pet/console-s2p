import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, ArrowRight, Loader2, ShowerHead } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { fetchConsoleUsers } from "@/services/endUserService";
import { useDebounce } from "@/hooks/useDebounce";

const EndUsersList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const { data: users, isLoading } = useQuery({
    queryKey: ["console-users", debouncedSearch],
    queryFn: () => fetchConsoleUsers(debouncedSearch),
  });

  const filtered = users ?? [];

  if (isLoading && !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
          <Users className="inline mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          Gestione Utenti
        </h1>
        <p className="text-sm text-muted-foreground">{filtered.length} utenti trovati</p>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome, cognome, email, telefono..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((u) => {
          const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "—";
          const initials = displayName.charAt(0).toUpperCase();
          return (
            <Card key={u.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => navigate(`/end-users/${u.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm truncate">{displayName}</p>
                      {u.is_guest && (
                        <span className="rounded-md bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">Guest</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email ?? "—"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShowerHead className="h-3 w-3" /> {u.total_washes} lavaggi
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nessun utente trovato.</p>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Lavaggi</th>
                <th className="p-4 font-medium">Registrato il</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => {
                const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                const initials = displayName.charAt(0).toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/end-users/${u.id}`)}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-foreground truncate">{displayName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground truncate max-w-[200px]">{u.email ?? "—"}</td>
                    <td className="p-4">
                      {u.is_guest ? (
                        <span className="rounded-md bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">Guest</span>
                      ) : (
                        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Registrato</span>
                      )}
                    </td>
                    <td className="p-4 text-foreground font-medium">
                      <div className="flex items-center gap-1">
                        <ShowerHead className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.total_washes}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("it-IT") : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nessun utente trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EndUsersList;
