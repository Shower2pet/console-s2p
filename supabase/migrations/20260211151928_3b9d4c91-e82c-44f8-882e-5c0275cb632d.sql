
-- Delete all test data in correct FK order
DELETE FROM wash_sessions WHERE station_id IN ('TEST-001','test-barboncino','test-husky','test-bracco','test-akita','A-005');
DELETE FROM maintenance_logs WHERE station_id IN ('TEST-001','test-barboncino','test-husky','test-bracco','test-akita','A-005');
DELETE FROM transactions WHERE structure_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR station_id IN ('TEST-001','test-barboncino','test-husky','test-bracco','test-akita','A-005');
DELETE FROM credit_packages WHERE structure_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM structure_wallets WHERE structure_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM structure_managers WHERE structure_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
DELETE FROM stations WHERE structure_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR id = 'A-005';
DELETE FROM structures WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
