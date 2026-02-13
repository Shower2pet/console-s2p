
-- Clean up test data
DELETE FROM structure_managers;
DELETE FROM structure_wallets;
DELETE FROM credit_packages;
DELETE FROM maintenance_logs;
DELETE FROM transactions;
DELETE FROM wash_sessions;
DELETE FROM station_access_logs;
DELETE FROM user_subscriptions;
DELETE FROM subscription_plans;
DELETE FROM partners_fiscal_data;

-- Reset stations
UPDATE stations SET owner_id = NULL, structure_id = NULL;

-- Delete structures
DELETE FROM structures;

-- Delete test profiles (keep admin)
DELETE FROM profiles WHERE id != '2f5bb35f-2c57-4796-a0cd-52c50a1ece6d';
