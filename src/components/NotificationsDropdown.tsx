import { Bell, Check, CheckCheck, Trash2, Wifi, WifiOff, Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ReactNode> = {
  station_offline: <WifiOff className="h-4 w-4 text-destructive" />,
  station_online: <Wifi className="h-4 w-4 text-green-500" />,
  station_maintenance: <Wrench className="h-4 w-4 text-orange-500" />,
};

const NotificationItem = ({
  notification,
  onRead,
  onDelete,
  onClick,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  onClick: () => void;
}) => {
  const icon = typeIcons[notification.type] ?? <Bell className="h-4 w-4 text-muted-foreground" />;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: it,
  });

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer border-b last:border-b-0",
        !notification.read && "bg-primary/5"
      )}
      onClick={onClick}
    >
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-tight", !notification.read && "font-semibold")}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{notification.message}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!notification.read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            className="p-1 rounded hover:bg-accent"
            title="Segna come letta"
          >
            <Check className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-accent"
          title="Elimina"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export const NotificationsDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    const stationId = (n.metadata as any)?.station_id;
    if (stationId) navigate(`/stations/${stationId}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifiche</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Segna tutte lette
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nessuna notifica</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={() => markAsRead.mutate(n.id)}
                onDelete={() => deleteNotification.mutate(n.id)}
                onClick={() => handleClick(n)}
              />
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
