
CREATE TABLE public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  error_message text NOT NULL,
  error_stack text,
  error_context text,
  page_url text,
  component text,
  severity text NOT NULL DEFAULT 'error',
  resolved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read error logs
CREATE POLICY "Admins can manage error logs"
  ON public.app_error_logs
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Any authenticated user can insert error logs (to report their own errors)
CREATE POLICY "Authenticated users can insert error logs"
  ON public.app_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon insert too for pre-auth errors
CREATE POLICY "Anon can insert error logs"
  ON public.app_error_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
