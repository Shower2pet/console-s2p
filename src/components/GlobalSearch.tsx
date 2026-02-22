import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Monitor, Users, Search } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: structures } = useQuery({
    queryKey: ["global-search-structures"],
    queryFn: async () => {
      const { data } = await supabase.from("structures").select("id, name, address");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: stations } = useQuery({
    queryKey: ["global-search-stations"],
    queryFn: async () => {
      const { data } = await supabase.from("stations").select("id, type, status, structure_id");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: clients } = useQuery({
    queryKey: ["global-search-clients"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email, legal_name, role").eq("role", "partner");
      return data ?? [];
    },
    enabled: open && isAdmin,
  });

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-80 flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Cerca stazioni, strutture...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cerca stazioni, strutture, clienti..." />
        <CommandList>
          <CommandEmpty>Nessun risultato trovato.</CommandEmpty>

          {(structures ?? []).length > 0 && (
            <CommandGroup heading="Strutture">
              {(structures ?? []).map((s) => (
                <CommandItem key={s.id} onSelect={() => go(`/structures/${s.id}`)} className="cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{s.name}</span>
                  {s.address && <span className="ml-2 text-xs text-muted-foreground">{s.address}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(stations ?? []).length > 0 && (
            <CommandGroup heading="Stazioni">
              {(stations ?? []).map((s) => (
                <CommandItem key={s.id} onSelect={() => go(`/stations/${s.id}`)} className="cursor-pointer">
                  <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{s.id}</span>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">{s.type} · {s.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {isAdmin && (clients ?? []).length > 0 && (
            <CommandGroup heading="Clienti">
              {(clients ?? []).map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/clients/${c.id}`)} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{c.legal_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
