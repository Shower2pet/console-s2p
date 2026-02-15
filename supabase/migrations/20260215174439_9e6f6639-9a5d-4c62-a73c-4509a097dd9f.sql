
-- Clean all test data, keep only admin (2f5bb35f-2c57-4796-a0cd-52c50a1ece6d) and products

-- 1. Delete dependent data first (FK order)
DELETE FROM station_access_logs;
DELETE FROM gate_commands;
DELETE FROM maintenance_logs;
DELETE FROM wash_sessions;
DELETE FROM transaction_receipts;
DELETE FROM daily_corrispettivi_logs;
DELETE FROM transactions;
DELETE FROM user_subscriptions;
DELETE FROM subscription_plans;
DELETE FROM credit_packages;
DELETE FROM structure_wallets;
DELETE FROM structure_managers;
DELETE FROM partners_fiscal_data;

-- 2. Reset all stations to inventory (keep hardware, remove user data)
UPDATE stations SET 
  owner_id = NULL,
  structure_id = NULL,
  geo_lat = NULL,
  geo_lng = NULL,
  washing_options = '[]'::jsonb,
  image_url = NULL,
  access_token = NULL,
  status = 'OFFLINE',
  visibility = 'HIDDEN';

-- 3. Delete all structures
DELETE FROM structures;

-- 4. Delete all non-admin profiles
DELETE FROM profiles WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';

-- 5. Delete all non-admin auth users
DELETE FROM auth.users WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';
