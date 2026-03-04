DO $do$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'check-expired-sessions-every-minute'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'check-expired-sessions-every-minute',
    '* * * * *',
    $cron$
    SELECT net.http_post(
      url:='https://rbdzinajiyswzdeoenil.supabase.co/functions/v1/check-expired-sessions',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZHppbmFqaXlzd3pkZW9lbmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzMyNzksImV4cCI6MjA4NjMwOTI3OX0.gwnlpDQHdz98pBB_jMP4e6XQTA03kjIcEWbXUkDse_o"}'::jsonb,
      body:='{"source":"pg_cron"}'::jsonb
    );
    $cron$
  );
END
$do$;