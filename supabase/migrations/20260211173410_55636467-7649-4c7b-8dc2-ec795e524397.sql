-- Fix: stations.owner_id should SET NULL on profile deletion
ALTER TABLE public.stations
  DROP CONSTRAINT stations_owner_id_fkey;

ALTER TABLE public.stations
  ADD CONSTRAINT stations_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Same fix for structure FK references to profiles
ALTER TABLE public.structures
  DROP CONSTRAINT structures_owner_id_fkey;

ALTER TABLE public.structures
  ADD CONSTRAINT structures_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;