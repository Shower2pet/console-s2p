import { Home, Monitor, Users, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { S2PLogo } from "@/components/S2PLogo";
import { CURRENT_ROLE } from "@/lib/mock-data";
import { useState } from "react";
import { cn } from "@/lib/utils";

const adminItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Stazioni", url: "/stations", icon: Monitor },
  { title: "Clienti", url: "/clients", icon: Users },
  { title: "Report Ricavi", url: "/revenue", icon: BarChart3 },
];

const clientItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Le Mie Stazioni", url: "/stations", icon: Monitor },
  { title: "Codici Sconto", url: "/discounts", icon: Tag },
  { title: "Report Ricavi", url: "/revenue", icon: BarChart3 },
  { title: "Impostazioni", url: "/settings", icon: Settings },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const items = CURRENT_ROLE === 'ADMIN' ? adminItems : clientItems;

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 min-h-screen relative",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <S2PLogo variant="icon" size={36} />
        {!collapsed && (
          <span className="font-heading text-lg font-bold text-sidebar-primary animate-slide-in-left">
            S2P Console
          </span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <span className="inline-block rounded-full bg-sidebar-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-accent-foreground">
            {CURRENT_ROLE === 'ADMIN' ? '👑 Admin' : '🏪 Partner'}
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

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
          collapsed && "justify-center px-2"
        )}>
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
