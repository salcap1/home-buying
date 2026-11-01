-- Replace hardcoded deed stamps + attorney/courier/recording with one board field.
ALTER TABLE home_buying.assumptions
  ADD COLUMN IF NOT EXISTS other_selling_fees numeric NOT NULL DEFAULT 0;
