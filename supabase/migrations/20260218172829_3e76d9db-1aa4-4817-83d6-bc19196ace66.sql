
-- Aggiunge colonna fiskaly_unit_id al profilo per salvare il UNIT asset id di Fiskaly
-- e fiskaly_entity_id per salvare l'entity id, così evitiamo di creare duplicati
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS fiskaly_unit_id text,
  ADD COLUMN IF NOT EXISTS fiskaly_entity_id text;

COMMENT ON COLUMN public.profiles.fiskaly_unit_id IS 'Fiskaly SIGN IT: ID dell''asset di tipo UNIT associato a questo partner';
COMMENT ON COLUMN public.profiles.fiskaly_entity_id IS 'Fiskaly SIGN IT: ID dell''entity (legal entity) associata a questo partner';
