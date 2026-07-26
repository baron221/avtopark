-- Revert a manual test installment made against id e4b2a9a7-... while
-- verifying the new partial-payment feature, back to its pre-test state.
UPDATE "station_payments" SET "status" = 'PAID', "paid_amount" = 0
  WHERE "id" = 'e4b2a9a7-b1a1-4850-b92c-415f511a5964';

-- Backfill: rows already marked PAID before paid_amount existed defaulted to
-- 0 on that new column. A fully paid invoice must have paid_amount = amount.
UPDATE "station_payments" SET "paid_amount" = "amount" WHERE "status" = 'PAID';
