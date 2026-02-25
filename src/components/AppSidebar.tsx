import { Home, Monitor, Users, LogOut, ChevronLeft, ChevronRight, Wrench, Euro, Building2, Package, UserCog, Settings, FileText, Warehouse, Menu, X, Shield, Store, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import logoHorizontal from "@/assets/logo-horizontal.png";
import logoVertical from "@/assets/logo-vertical.png";

const adminItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Gestione Partner", url: "/clients", icon: Users },
  { title: "Tutte le Strutture", url: "/structures", icon: Building2 },
  { title: "Tutte le Stazioni", url: "/stations", icon: Monitor },
  { title: "Catalogo Prodotti", url: "/products", icon: Package },
  { title: "Resoconto Incassi", url: "/revenue", icon: Euro },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
  { title: "Magazzino", url: "/inventory", icon: Warehouse },
  { title: "Impostazioni Sistema", url: "/admin-settings", icon: Settings },
];

const partnerItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Le Mie Strutture", url: "/structures", icon: Building2 },
  { title: "Le Mie Stazioni", url: "/stations", icon: Monitor },
  { title: "Pacchetti Crediti", url: "/packages", icon: Package },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
  { title: "Transazioni & Report", url: "/financials", icon: Euro },
  { title: "Profilo Fiscale", url: "/settings", icon: FileText },
];

const managerItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "La Mia Struttura", url: "/structures", icon: Building2 },
  { title: "Gestione Stazioni", url: "/stations", icon: Monitor },
  { title: "Manutenzione", url: "/maintenance", icon: Wrench },
];

const roleConfig: Record<string, { label: string; icon: typeof Shield }> = {
  admin: { label: "Admin", icon: Shield },
  partner: { label: "Partner", icon: Store },
  manager: { label: "Manager", icon: Wrench },
  user: { label: "Utente", icon: User },
};

// Shared nav content
const SidebarNav = ({ items, collapsed, role, displayName, email, onLogout, onNavigate }: {
  items: typeof adminItems;
  collapsed: boolean;
  role: string | null;
  displayName: string;
  email: string | undefined;
  onLogout: () => void;
  onNavigate?: () => void;
}) => (
  <>
    {/* Logo */}
    <div className="flex items-center justify-center p-4 border-b border-sidebar-border">
      <div className={cn("rounded-lg bg-white/95 flex items-center justify-center", collapsed ? "p-1.5" : "px-3 py-1.5")}>
        {collapsed ? (
          <img src={logoVertical} alt="S2P" className="w-7 h-7 object-contain flex-shrink-0" />
        ) : (
          <img src={logoHorizontal} alt="Shower2Pet" className="h-8 object-contain" />
        )}
      </div>
    </div>

    {/* Role badge */}
    {!collapsed && (
      <div className="px-4 pt-3 pb-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-accent-foreground">
          {(() => { const rc = roleConfig[role ?? "user"]; const Icon = rc.icon; return <><Icon className="h-3 w-3" />{rc.label}</>; })()}
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
          onClick={onNavigate}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      ))}
    </nav>

    {/* User info */}
    <div className="border-t border-sidebar-border p-3">
      {!collapsed && (
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-sidebar-foreground/90 truncate">{displayName}</p>
          <p className="text-[10px] text-sidebar-foreground/50 truncate">{email}</p>
        </div>
      )}
    </div>
  </>
);

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = role === "admin" ? adminItems : role === "partner" ? partnerItems : managerItems;
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Utente";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 min-h-screen relative",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarNav
          items={items}
          collapsed={collapsed}
          role={role}
          displayName={displayName}
          email={profile?.email ?? undefined}
          onLogout={handleLogout}
        />
        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  );
};

// Mobile sidebar trigger exported for header
export const MobileSidebarTrigger = () => {
  const [open, setOpen] = useState(false);
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = role === "admin" ? adminItems : role === "partner" ? partnerItems : managerItems;
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Utente";

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="md:hidden rounded-lg p-2 hover:bg-accent transition-colors">
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border [&>button]:hidden">
        <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
        <div className="flex flex-col h-full">
          <SidebarNav
            items={items}
            collapsed={false}
            role={role}
            displayName={displayName}
            email={profile?.email ?? undefined}
            onLogout={handleLogout}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
