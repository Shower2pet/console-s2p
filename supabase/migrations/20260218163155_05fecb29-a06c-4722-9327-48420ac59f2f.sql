-- Ricrea la FK con ON DELETE SET NULL per evitare blocchi futuri
-- (SET NULL perché user_id in gate_commands è nullable)
ALTER TABLE public.gate_commands
  DROP CONSTRAINT IF EXISTS gate_commands_user_id_fkey;

ALTER TABLE public.gate_commands
  ADD CONSTRAINT gate_commands_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;