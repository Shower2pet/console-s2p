import { Bell, Search, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CURRENT_ROLE } from "@/lib/mock-data";
import { S2PLogo } from "@/components/S2PLogo";
import { Link } from "react-router-dom";

export const AppHeader = () => (
  <header className="flex h-16 items-center justify-between border-b bg-card px-6">
    <div className="relative w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Cerca stazioni, clienti..."
        className="pl-10 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
      />
    </div>
    <div className="flex items-center gap-4">
      <button className="relative rounded-lg p-2 hover:bg-accent transition-colors">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
      </button>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading text-sm font-bold">
          {CURRENT_ROLE === 'ADMIN' ? 'A' : 'C'}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-foreground">
            {CURRENT_ROLE === 'ADMIN' ? 'Admin S2P' : 'PetShop Roma'}
          </p>
          <p className="text-xs text-muted-foreground">
            {CURRENT_ROLE === 'ADMIN' ? 'Amministratore' : 'Partner'}
          </p>
        </div>
      </div>
    </div>
  </header>
);
