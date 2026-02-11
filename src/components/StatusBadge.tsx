import { cn } from "@/lib/utils";

type StatusValue = string;

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

const normalize = (s: string) => s.toUpperCase();

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  AVAILABLE: { label: "Disponibile", dot: "bg-success", bg: "bg-success/20 text-success-foreground border-success/30" },
  ONLINE: { label: "Online", dot: "bg-success", bg: "bg-success/20 text-success-foreground border-success/30" },
  ACTIVE: { label: "Attivo", dot: "bg-success", bg: "bg-success/20 text-success-foreground border-success/30" },
  BUSY: { label: "Occupata", dot: "bg-warning", bg: "bg-warning/20 text-warning-foreground border-warning/30" },
  OFFLINE: { label: "Offline", dot: "bg-destructive", bg: "bg-destructive/20 text-destructive border-destructive/30" },
  INACTIVE: { label: "Inattivo", dot: "bg-destructive", bg: "bg-destructive/20 text-destructive border-destructive/30" },
  MAINTENANCE: { label: "Manutenzione", dot: "bg-warning", bg: "bg-warning/20 text-warning-foreground border-warning/30" },
};

const fallback = { label: "Sconosciuto", dot: "bg-muted-foreground", bg: "bg-muted text-muted-foreground border-border" };

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[normalize(status)] ?? fallback;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", config.bg, className)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
};
