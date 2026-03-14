-- Deep Clean: preserva solo admin@shower2pet.com
-- 1. Sessioni e log operativi
DELETE FROM public.wash_sessions;
DELETE FROM public.station_access_logs;
DELETE FROM public.gate_commands;
DELETE FROM public.station_ratings;

-- 2. Transazioni e ricevute
DELETE FROM public.transaction_receipts;
DELETE FROM public.transactions;

-- 3. Manutenzione
DELETE FROM public.maintenance_logs;

-- 4. Notifiche e note
DELETE FROM public.notifications;
DELETE FROM public.user_notes;

-- 5. Wallet e abbonamenti
DELETE FROM public.structure_wallets;
DELETE FROM public.user_subscriptions;
DELETE FROM public.subscription_plans;

-- 6. Pacchetti crediti
DELETE FROM public.credit_packages;

-- 7. Corrispettivi
DELETE FROM public.daily_corrispettivi_logs;

-- 8. Referenti partner
DELETE FROM public.partner_referents;

-- 9. Dati fiscali partner
DELETE FROM public.partners_fiscal_data;

-- 10. Board
DELETE FROM public.boards;

-- 11. Stazioni
DELETE FROM public.stations;

-- 12. Manager strutture
DELETE FROM public.structure_managers;

-- 13. Strutture
DELETE FROM public.structures;

-- 14. Prodotti
DELETE FROM public.products;

-- 15. Error logs
DELETE FROM public.app_error_logs;

-- 16. Profili (tutti tranne admin)
DELETE FROM public.profiles WHERE email != 'admin@shower2pet.com';

-- 17. Utenti auth (tutti tranne admin) via service role
DELETE FROM auth.users WHERE email != 'admin@shower2pet.com';

-- 18. Reset campi Fiskaly sull'admin
UPDATE public.profiles 
SET fiskaly_system_id = NULL, fiskaly_entity_id = NULL, fiskaly_unit_id = NULL 
WHERE email = 'admin@shower2pet.com';