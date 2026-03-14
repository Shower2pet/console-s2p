
-- Deep Clean: remove all data except admin profile (admin@shower2pet.com)
-- ID: 2f5bb35f-2c57-4796-a0cd-52c50a1ece6d

-- 1. Tables with no dependents or leaf tables first
DELETE FROM app_error_logs;
DELETE FROM notifications;
DELETE FROM user_notes;
DELETE FROM station_ratings;
DELETE FROM station_access_logs;
DELETE FROM gate_commands;
DELETE FROM daily_corrispettivi_logs;
DELETE FROM transaction_receipts;
DELETE FROM transactions;
DELETE FROM wash_sessions;
DELETE FROM maintenance_logs;
DELETE FROM user_subscriptions;
DELETE FROM subscription_plans;
DELETE FROM credit_packages;
DELETE FROM partner_referents;
DELETE FROM structure_wallets;
DELETE FROM structure_managers;

-- 2. Boards (before stations)
DELETE FROM boards;

-- 3. Stations
DELETE FROM stations;

-- 4. Structures
DELETE FROM structures;

-- 5. Partners fiscal data
DELETE FROM partners_fiscal_data;

-- 6. Products (admin-managed catalog)
DELETE FROM products;

-- 7. Profiles except admin
DELETE FROM profiles WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';

-- 8. Delete non-admin users from auth.users
DELETE FROM auth.users WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';
