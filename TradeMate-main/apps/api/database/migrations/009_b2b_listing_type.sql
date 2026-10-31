-- Convert the legacy product listing type into the B2B opportunity type.
-- The live application already maps non-service marketplace offers to B2B.
ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_listing_type_check;

UPDATE listings
SET listing_type = 'b2b',
    updated_at = now()
WHERE listing_type = 'product';

ALTER TABLE listings
  ALTER COLUMN listing_type SET DEFAULT 'service';

ALTER TABLE listings
  ADD CONSTRAINT listings_listing_type_check
  CHECK (listing_type IN ('service', 'b2b'));
