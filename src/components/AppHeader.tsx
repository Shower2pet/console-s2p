import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileSidebarTrigger } from "@/components/AppSidebar";

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
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 md:px-6 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MobileSidebarTrigger />
        <div className="hidden sm:block flex-1">
          <GlobalSearch />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile search - icon only */}
        <div className="sm:hidden">
          <GlobalSearch mobileIcon />
        </div>
        <button className="relative rounded-lg p-2 hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading text-sm font-bold">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[role ?? "user"]}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
