import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: 'default' | 'primary' | 'success' | 'warning';
  href?: string;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-success/10 border-success/20',
  warning: 'bg-warning/10 border-warning/20',
};

const iconStyles = {
  default: 'bg-accent text-accent-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/20 text-success-foreground',
  warning: 'bg-warning/20 text-warning-foreground',
};

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = 'default', href }: StatCardProps) => {
  const content = (
    <Card className={cn("animate-fade-in border h-full", variantStyles[variant], href && "hover:shadow-md hover:border-primary/30 transition-all cursor-pointer")}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-heading font-bold text-foreground truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            {trend && (
              <p className={cn("text-xs font-medium", trend.positive ? "text-success-foreground" : "text-destructive")}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          <div className={cn("rounded-xl p-2 sm:p-3 flex-shrink-0", iconStyles[variant])}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link to={href} className="block">{content}</Link>;
  return content;
};
