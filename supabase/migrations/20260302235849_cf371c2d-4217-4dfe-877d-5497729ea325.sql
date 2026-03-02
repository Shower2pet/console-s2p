
-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Updated trigger: notifies owner + admins + managers, and sends email via edge function
CREATE OR REPLACE FUNCTION public.notify_station_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_station_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.structure_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner_id FROM structures WHERE id = NEW.structure_id;
  END IF;
  IF v_owner_id IS NULL THEN
    v_owner_id := NEW.owner_id;
  END IF;

  v_station_label := NEW.id;

  -- ── Station went OFFLINE ──
  IF NEW.status = 'OFFLINE' AND OLD.status != 'OFFLINE' THEN
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (v_owner_id, 'station_offline', 'Stazione Offline',
        'La stazione ' || v_station_label || ' è andata offline.',
        jsonb_build_object('station_id', NEW.id));
    END IF;
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'station_offline', 'Stazione Offline',
      'La stazione ' || v_station_label || ' è andata offline.',
      jsonb_build_object('station_id', NEW.id)
    FROM profiles p WHERE p.role = 'admin' AND p.id IS DISTINCT FROM v_owner_id;
    IF NEW.structure_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      SELECT sm.user_id, 'station_offline', 'Stazione Offline',
        'La stazione ' || v_station_label || ' è andata offline.',
        jsonb_build_object('station_id', NEW.id)
      FROM structure_managers sm
      WHERE sm.structure_id = NEW.structure_id AND sm.user_id IS DISTINCT FROM v_owner_id;
    END IF;

    PERFORM net.http_post(
      url := 'https://rbdzinajiyswzdeoenil.supabase.co/functions/v1/send-station-alert',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZHppbmFqaXlzd3pkZW9lbmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzMyNzksImV4cCI6MjA4NjMwOTI3OX0.gwnlpDQHdz98pBB_jMP4e6XQTA03kjIcEWbXUkDse_o"}'::jsonb,
      body := jsonb_build_object('station_id', NEW.id, 'new_status', NEW.status::text, 'old_status', OLD.status::text)
    );
  END IF;

  -- ── Station back ONLINE from OFFLINE ──
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
    IF NEW.structure_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      SELECT sm.user_id, 'station_online', 'Stazione Online',
        'La stazione ' || v_station_label || ' è tornata online.',
        jsonb_build_object('station_id', NEW.id)
      FROM structure_managers sm
      WHERE sm.structure_id = NEW.structure_id AND sm.user_id IS DISTINCT FROM v_owner_id;
    END IF;

    PERFORM net.http_post(
      url := 'https://rbdzinajiyswzdeoenil.supabase.co/functions/v1/send-station-alert',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZHppbmFqaXlzd3pkZW9lbmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzMyNzksImV4cCI6MjA4NjMwOTI3OX0.gwnlpDQHdz98pBB_jMP4e6XQTA03kjIcEWbXUkDse_o"}'::jsonb,
      body := jsonb_build_object('station_id', NEW.id, 'new_status', NEW.status::text, 'old_status', OLD.status::text)
    );
  END IF;

  -- ── Station went to MAINTENANCE ──
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
    IF NEW.structure_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      SELECT sm.user_id, 'station_maintenance', 'Stazione in Manutenzione',
        'La stazione ' || v_station_label || ' è in manutenzione.',
        jsonb_build_object('station_id', NEW.id)
      FROM structure_managers sm
      WHERE sm.structure_id = NEW.structure_id AND sm.user_id IS DISTINCT FROM v_owner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on stations
DROP TRIGGER IF EXISTS trg_notify_station_status ON stations;
CREATE TRIGGER trg_notify_station_status
  AFTER UPDATE OF status ON stations
  FOR EACH ROW
  EXECUTE FUNCTION notify_station_status_change();
