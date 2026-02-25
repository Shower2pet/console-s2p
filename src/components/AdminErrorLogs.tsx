import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchErrorLogs, resolveErrorLog, resolveAllErrorLogs } from "@/services/errorLogService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Trash2, RefreshCw, Bug, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const severityColor: Record<string, string> = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  critical: "bg-red-600/10 text-red-700 border-red-600/20",
};

const ErrorLogRow = ({ log, onResolve }: { log: any; onResolve: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${log.resolved ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <button className="mt-0.5 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${severityColor[log.severity] ?? ""}`}>
              {log.severity}
            </Badge>
            {log.resolved && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle className="h-3 w-3" /> Risolto
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss", { locale: it })}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">{log.error_message}</p>
          {log.user_email && (
            <p className="text-xs text-muted-foreground">Utente: {log.user_email}</p>
          )}
        </div>
        {!log.resolved && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 h-7 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); onResolve(log.id); }}
          >
            <CheckCircle className="h-3 w-3" /> Risolvi
          </Button>
        )}
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2 text-xs">
          {log.error_context && (
            <div>
              <span className="font-medium text-muted-foreground">Contesto: </span>
              <span className="text-foreground">{log.error_context}</span>
            </div>
          )}
          {log.page_url && (
            <div>
              <span className="font-medium text-muted-foreground">Pagina: </span>
              <span className="text-foreground font-mono">{log.page_url}</span>
            </div>
          )}
          {log.component && (
            <div>
              <span className="font-medium text-muted-foreground">Componente: </span>
              <span className="text-foreground">{log.component}</span>
            </div>
          )}
          {log.error_stack && (
            <div>
              <span className="font-medium text-muted-foreground">Stack trace:</span>
              <pre className="mt-1 p-2 bg-muted rounded text-foreground whitespace-pre-wrap break-all font-mono">
                {log.error_stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AdminErrorLogs = () => {
  const qc = useQueryClient();
  const [onlyUnresolved, setOnlyUnresolved] = useState(true);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["error-logs", onlyUnresolved],
    queryFn: () => fetchErrorLogs(200, onlyUnresolved),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveErrorLog,
    onSuccess: () => {
      toast.success("Errore segnato come risolto");
      qc.invalidateQueries({ queryKey: ["error-logs"] });
    },
    onError: () => toast.error("Errore nel risolvere il log"),
  });

  const resolveAllMutation = useMutation({
    mutationFn: resolveAllErrorLogs,
    onSuccess: () => {
      toast.success("Tutti gli errori segnati come risolti");
      qc.invalidateQueries({ queryKey: ["error-logs"] });
    },
    onError: () => toast.error("Errore"),
  });

  const unresolvedCount = logs.filter((l: any) => !l.resolved).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          Log Errori Applicazione
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolvedCount}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Errori catturati automaticamente dalla dashboard. Gli utenti vedono un messaggio generico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="filter-unresolved"
                checked={onlyUnresolved}
                onCheckedChange={setOnlyUnresolved}
              />
              <Label htmlFor="filter-unresolved" className="text-sm">Solo non risolti</Label>
            </div>
          </div>
          <div className="flex gap-2">
            {unresolvedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => resolveAllMutation.mutate()}
                disabled={resolveAllMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Risolvi tutti
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento log...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm">Nessun errore {onlyUnresolved ? "non risolto" : ""} trovato.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map((log: any) => (
              <ErrorLogRow key={log.id} log={log} onResolve={(id) => resolveMutation.mutate(id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
