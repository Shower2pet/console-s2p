import { Home, Monitor, Users, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Wrench, Euro, Building2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import logoHorizontal from "@/assets/logo-horizontal.png";
import logoVertical from "@/assets/logo-vertical.png";

const adminItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Strutture", url: "/structures", icon: Building2 },
  { title: "Stazioni", url: "/stations", icon: Monitor },
  { title: "Clienti", url: "/clients", icon: Users },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
  { title: "Report Ricavi", url: "/revenue", icon: BarChart3 },
  { title: "Fiscalità", url: "/financials", icon: Euro },
  { title: "Impostazioni", url: "/settings", icon: Settings },
];

const partnerItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Le Mie Strutture", url: "/structures", icon: Building2 },
  { title: "Stazioni", url: "/stations", icon: Monitor },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
  { title: "Fiscalità", url: "/financials", icon: Euro },
  { title: "Impostazioni", url: "/settings", icon: Settings },
];

const managerItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Struttura", url: "/structures", icon: Building2 },
  { title: "Stazioni", url: "/stations", icon: Monitor },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
  { title: "Impostazioni", url: "/settings", icon: Settings },
];

const roleEmoji: Record<string, string> = {
  admin: "👑 Admin",
  partner: "🏪 Partner",
  manager: "🔧 Manager",
  user: "👤 Utente",
};

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();

  const items = role === "admin" ? adminItems : role === "partner" ? partnerItems : managerItems;
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Utente";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 min-h-screen relative",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center justify-center p-4 border-b border-sidebar-border">
        {collapsed ? (
          <img src={logoVertical} alt="S2P" className="w-8 h-8 object-contain flex-shrink-0" />
        ) : (
          <img src={logoHorizontal} alt="Shower2Pet" className="h-10 object-contain" />
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <span className="inline-block rounded-full bg-sidebar-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-accent-foreground">
            {roleEmoji[role ?? "user"]}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/'}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-2"
            )}
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info & Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground/90 truncate">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile?.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Esci</span>}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
};
