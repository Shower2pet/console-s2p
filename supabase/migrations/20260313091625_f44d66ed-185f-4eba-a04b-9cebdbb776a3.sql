
-- FASE 0: Pulizia completa database
-- Tabelle dipendenti prima
DELETE FROM station_ratings;
DELETE FROM transaction_receipts;
DELETE FROM wash_sessions;
DELETE FROM transactions;
DELETE FROM gate_commands;
DELETE FROM station_access_logs;
DELETE FROM user_notes;
DELETE FROM structure_wallets;
DELETE FROM maintenance_logs;
DELETE FROM notifications;
DELETE FROM partner_referents;
DELETE FROM structure_managers;
DELETE FROM credit_packages;
DELETE FROM user_subscriptions;
DELETE FROM subscription_plans;
DELETE FROM daily_corrispettivi_logs;
DELETE FROM partners_fiscal_data;
DELETE FROM app_error_logs;

-- Entità principali
DELETE FROM boards;
DELETE FROM stations;
DELETE FROM structures;

-- Profili non-admin
DELETE FROM profiles WHERE role != 'admin';

-- Eliminare auth users non-admin
DELETE FROM auth.users WHERE id IN (
  '46634d76-0ced-4823-938f-dbac877d5bca',
  '1c499ef1-5641-4022-a179-c3cdff02ee79',
  'a93acd7a-43bd-473a-89eb-8cf34693cca9'
);
