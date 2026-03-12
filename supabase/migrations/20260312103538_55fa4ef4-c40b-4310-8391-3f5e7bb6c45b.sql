
-- Create boards table
CREATE TABLE public.boards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('ethernet', 'wifi')),
  model TEXT NOT NULL DEFAULT '',
  station_id TEXT REFERENCES public.stations(id) ON DELETE SET NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage boards" ON public.boards
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Partners can read boards assigned to their stations
CREATE POLICY "Partners read own boards" ON public.boards
  FOR SELECT TO authenticated
  USING (
    station_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM stations s
        WHERE s.id = boards.station_id AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM stations s
        JOIN structures st ON st.id = s.structure_id
        WHERE s.id = boards.station_id AND st.owner_id = auth.uid()
      )
    )
  );

-- Function to generate next board ID
CREATE OR REPLACE FUNCTION public.generate_board_id(board_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prefix TEXT;
  max_num INT;
  new_id TEXT;
BEGIN
  IF board_type = 'ethernet' THEN
    prefix := 'ETH_';
  ELSIF board_type = 'wifi' THEN
    prefix := 'WIFI_';
  ELSE
    RAISE EXCEPTION 'Invalid board type: %', board_type;
  END IF;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(id FROM LENGTH(prefix) + 1) AS INT)
  ), 0) INTO max_num
  FROM boards
  WHERE id LIKE prefix || '%';

  new_id := prefix || (max_num + 1)::TEXT;
  RETURN new_id;
END;
$$;
