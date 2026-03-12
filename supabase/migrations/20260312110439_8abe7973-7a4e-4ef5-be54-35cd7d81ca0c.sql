-- Clean all data except admin profile (admin@shower2pet.com)

-- 1. Child tables first (no FK dependencies)
DELETE FROM public.user_notes;
DELETE FROM public.notifications;
DELETE FROM public.app_error_logs;
DELETE FROM public.station_access_logs;
DELETE FROM public.gate_commands;
DELETE FROM public.transaction_receipts;
DELETE FROM public.daily_corrispettivi_logs;

-- 2. Sessions & transactions
DELETE FROM public.wash_sessions;
DELETE FROM public.transactions;

-- 3. Subscriptions
DELETE FROM public.user_subscriptions;
DELETE FROM public.subscription_plans;

-- 4. Credit packages & wallets
DELETE FROM public.credit_packages;
DELETE FROM public.structure_wallets;

-- 5. Maintenance
DELETE FROM public.maintenance_logs;

-- 6. Partner data
DELETE FROM public.partner_referents;
DELETE FROM public.partners_fiscal_data;

-- 7. Structure managers
DELETE FROM public.structure_managers;

-- 8. Boards (before stations)
DELETE FROM public.boards;

-- 9. Stations
DELETE FROM public.stations;

-- 10. Structures
DELETE FROM public.structures;

-- 11. Products
DELETE FROM public.products;

-- 12. Profiles (keep only admin)
DELETE FROM public.profiles WHERE email != 'admin@shower2pet.com';