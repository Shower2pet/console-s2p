
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_read ON public.notifications (user_id, read, created_at DESC);

-- Trigger function: create notifications on station status change
CREATE OR REPLACE FUNCTION public.notify_station_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_station_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Find owner via structure
  IF NEW.structure_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner_id FROM structures WHERE id = NEW.structure_id;
  END IF;
  IF v_owner_id IS NULL THEN
    v_owner_id := NEW.owner_id;
  END IF;

  v_station_label := NEW.id;

  -- Station went OFFLINE
  IF NEW.status = 'OFFLINE' AND OLD.status != 'OFFLINE' THEN
    -- Notify owner
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_owner_id, 'station_offline', 'Stazione Offline',
        'La stazione ' || v_station_label || ' è andata offline.',
        jsonb_build_object('station_id', NEW.id));
    END IF;
    -- Notify admins
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'station_offline', 'Stazione Offline',
      'La stazione ' || v_station_label || ' è andata offline.',
      jsonb_build_object('station_id', NEW.id)
    FROM profiles p WHERE p.role = 'admin' AND p.id IS DISTINCT FROM v_owner_id;
  END IF;

  -- Station back ONLINE (AVAILABLE from OFFLINE)
  IF NEW.status = 'AVAILABLE' AND OLD.status = 'OFFLINE' THEN
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_owner_id, 'station_online', 'Stazione Online',
        'La stazione ' || v_station_label || ' è tornata online.',
        jsonb_build_object('station_id', NEW.id));
    END IF;
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'station_online', 'Stazione Online',
      'La stazione ' || v_station_label || ' è tornata online.',
      jsonb_build_object('station_id', NEW.id)
    FROM profiles p WHERE p.role = 'admin' AND p.id IS DISTINCT FROM v_owner_id;
  END IF;

  -- Station went to MAINTENANCE
  IF NEW.status = 'MAINTENANCE' AND OLD.status != 'MAINTENANCE' THEN
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_owner_id, 'station_maintenance', 'Stazione in Manutenzione',
        'La stazione ' || v_station_label || ' è in manutenzione.',
        jsonb_build_object('station_id', NEW.id));
    END IF;
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'station_maintenance', 'Stazione in Manutenzione',
      'La stazione ' || v_station_label || ' è in manutenzione.',
      jsonb_build_object('station_id', NEW.id)
    FROM profiles p WHERE p.role = 'admin' AND p.id IS DISTINCT FROM v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_station_status_change
  AFTER UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION notify_station_status_change();
