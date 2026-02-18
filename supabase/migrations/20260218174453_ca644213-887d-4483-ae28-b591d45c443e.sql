-- Reset Fiskaly IDs for WashDog so we can test the full flow from scratch
UPDATE profiles 
SET fiskaly_system_id = NULL, 
    fiskaly_entity_id = NULL, 
    fiskaly_unit_id = NULL 
WHERE email = 'washdog@mail.com';