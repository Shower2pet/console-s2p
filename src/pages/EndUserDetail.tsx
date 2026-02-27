import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, User, Wallet, MessageSquare, Send, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchConsoleUserDetail,
  fetchUserNotes,
  addUserNote,
  fetchUserWallets,
  updateWalletBalance,
} from "@/services/endUserService";

const EndUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [noteContent, setNoteContent] = useState("");
  const [creditAdjustments, setCreditAdjustments] = useState<Record<string, string>>({});

  const { data: userDetail, isLoading } = useQuery({
    queryKey: ["console-user-detail", id],
    queryFn: () => fetchConsoleUserDetail(id!),
    enabled: !!id,
  });

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ["user-notes", id],
    queryFn: () => fetchUserNotes(id!),
    enabled: !!id,
  });

  const { data: wallets } = useQuery({
    queryKey: ["user-wallets", id],
    queryFn: () => fetchUserWallets(id!),
    enabled: !!id,
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addUserNote(id!, currentUser!.id, noteContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notes", id] });
      setNoteContent("");
      toast.success("Nota aggiunta");
    },
    onError: () => toast.error("Errore nell'aggiunta della nota"),
  });

  const updateWalletMutation = useMutation({
    mutationFn: ({ walletId, newBalance }: { walletId: string; newBalance: number }) =>
      updateWalletBalance(walletId, newBalance),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-wallets", id] });
      setCreditAdjustments({});
      toast.success("Crediti aggiornati");
    },
    onError: () => toast.error("Errore nell'aggiornamento crediti"),
  });

  const handleCreditAdjust = (walletId: string, currentBalance: number, delta: number) => {
    const adjustment = parseFloat(creditAdjustments[walletId] || "0");
    if (isNaN(adjustment) || adjustment <= 0) {
      toast.error("Inserisci un valore valido");
      return;
    }
    const newBalance = currentBalance + adjustment * delta;
    if (newBalance < 0) {
      toast.error("Il saldo non può essere negativo");
      return;
    }
    updateWalletMutation.mutate({ walletId, newBalance });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/end-users")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
        </Button>
        <p className="text-muted-foreground text-center py-8">Utente non trovato o accesso non autorizzato.</p>
      </div>
    );
  }

  const displayName = [userDetail.first_name, userDetail.last_name].filter(Boolean).join(" ") || userDetail.email || "Utente";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/end-users")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
            <User className="inline mr-2 h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">{userDetail.email}</p>
        </div>
      </div>

      {/* User Info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="font-medium text-foreground">{userDetail.first_name || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cognome</p>
            <p className="font-medium text-foreground">{userDetail.last_name || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium text-foreground truncate">{userDetail.email || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Telefono</p>
            <p className="font-medium text-foreground">{userDetail.phone || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Wallets / Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            Crediti per Struttura
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!wallets || wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun wallet trovato per questo utente.</p>
          ) : (
            <div className="space-y-4">
              {wallets.map((w: any) => (
                <div key={w.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {(w.structures as any)?.name ?? "Struttura sconosciuta"}
                    </p>
                    <p className="text-lg font-bold text-primary">{Number(w.balance ?? 0).toFixed(2)} crediti</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Quantità"
                      className="w-28"
                      value={creditAdjustments[w.id] ?? ""}
                      onChange={(e) => setCreditAdjustments((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreditAdjust(w.id, Number(w.balance ?? 0), -1)}
                      disabled={updateWalletMutation.isPending}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreditAdjust(w.id, Number(w.balance ?? 0), 1)}
                      disabled={updateWalletMutation.isPending}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Note sul Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add note form */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Aggiungi una nota su questo cliente..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              size="icon"
              className="self-end h-10 w-10 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          ) : !notes || notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna nota presente.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-foreground">
                      {note.author_name}
                      {note.author_email && (
                        <span className="text-muted-foreground ml-1">({note.author_email})</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(note.created_at).toLocaleString("it-IT")}
                    </p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EndUserDetail;
