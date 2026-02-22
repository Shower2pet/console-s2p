import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalSearch } from "@/components/GlobalSearch";

const roleLabels: Record<string, string> = {
  admin: "Amministratore",
  partner: "Partner",
  manager: "Manager",
  user: "Utente",
};

export const AppHeader = () => {
  const { profile, role } = useAuth();
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Utente";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <GlobalSearch />
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading text-sm font-bold">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[role ?? "user"]}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
