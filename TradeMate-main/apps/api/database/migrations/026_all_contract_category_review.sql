-- All ten contract categories share the persistent listing and moderation workflow.
-- listing_type remains commercial behaviour (service vs B2B inventory); division
-- records the Explore contract category independently.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS division TEXT;
UPDATE listings SET division = CASE WHEN listing_type = 'b2b' THEN 'b2b' ELSE 'services' END WHERE division IS NULL;
ALTER TABLE listings ALTER COLUMN division SET DEFAULT 'services';
ALTER TABLE listings ALTER COLUMN division SET NOT NULL;
ALTER TABLE listings ADD CONSTRAINT listings_division_check CHECK (division IN ('services','real_estate','software','b2b','industrial_trade','agriculture','finance_investment','institution_infrastructure','sports','entertainment'));
CREATE INDEX IF NOT EXISTS listings_division_discovery_idx ON listings (division, country_code, status, created_at DESC);
