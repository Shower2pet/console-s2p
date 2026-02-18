-- Elimina gate_commands residui per washdog (bloccano la FK)
DELETE FROM public.gate_commands WHERE user_id = '9476105c-5267-4bd1-b49a-cd3986ed22be';

-- Elimina eventuali station_access_logs residui
DELETE FROM public.station_access_logs WHERE user_id = '9476105c-5267-4bd1-b49a-cd3986ed22be';

-- Elimina l'utente auth orfano direttamente
DELETE FROM auth.users WHERE id = '9476105c-5267-4bd1-b49a-cd3986ed22be';