-- Each beach house has an optional fixed transport price that overrides the
-- standard route rate when transport is linked to a stay at this property.

ALTER TABLE beach_houses
  ADD COLUMN IF NOT EXISTS transport_price numeric;
