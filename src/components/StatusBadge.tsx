import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'maintenance' | 'active' | 'inactive';
  className?: string;
}

const statusConfig = {
  online: { label: 'Online', className: 'bg-success/20 text-success-foreground border-success/30' },
  active: { label: 'Attivo', className: 'bg-success/20 text-success-foreground border-success/30' },
  offline: { label: 'Offline', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  inactive: { label: 'Inattivo', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  maintenance: { label: 'Manutenzione', className: 'bg-warning/20 text-warning-foreground border-warning/30' },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      config.className,
      className
    )}>
      <span className={cn(
        "h-2 w-2 rounded-full",
        status === 'online' || status === 'active' ? 'bg-success' : '',
        status === 'offline' || status === 'inactive' ? 'bg-destructive' : '',
        status === 'maintenance' ? 'bg-warning' : '',
      )} />
      {config.label}
    </span>
  );
};
