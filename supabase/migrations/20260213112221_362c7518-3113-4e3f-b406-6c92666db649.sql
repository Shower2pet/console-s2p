
-- Remove hardcoded type check since station types now come from the products table
ALTER TABLE stations DROP CONSTRAINT stations_type_check;

-- Also drop the generated category column since it was based on hardcoded type names
-- and product types are now dynamic from the products table
ALTER TABLE stations DROP COLUMN category;
