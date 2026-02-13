
-- Pulizia completa dati di test (mantiene solo admin@shower2pet.com)
DELETE FROM maintenance_logs;
DELETE FROM transactions;
DELETE FROM wash_sessions;
DELETE FROM station_access_logs;
DELETE FROM structure_wallets;
DELETE FROM user_subscriptions;
DELETE FROM subscription_plans;
DELETE FROM credit_packages;
DELETE FROM partners_fiscal_data;
DELETE FROM structure_managers;
DELETE FROM stations;
DELETE FROM structures;
DELETE FROM products;
DELETE FROM profiles WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';
