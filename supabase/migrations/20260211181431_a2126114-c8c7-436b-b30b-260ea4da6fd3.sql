-- Reset all 5 stations back to inventory (one-time cleanup)
UPDATE public.stations 
SET 
  owner_id = NULL, 
  structure_id = NULL, 
  geo_lat = NULL, 
  geo_lng = NULL, 
  washing_options = '[]'::jsonb, 
  image_url = NULL, 
  access_token = NULL, 
  status = 'OFFLINE', 
  visibility = 'HIDDEN'
WHERE id IN ('AKI', 'BA_001', 'BR_001', 'rom', 'SN');