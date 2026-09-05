-- Widen CashHandover's uniqueness from (point, handover_date) to include
-- dispatcher_confirmed_by, so more than one dispatcher can each hand over
-- their own personally-collected portion for the same point on the same
-- day (shift rotation). Safe/additive: a row set already unique on the
-- narrower key is automatically unique on this superset, so no existing
-- data can violate it.
DROP INDEX "cash_handovers_point_handover_date_key";

CREATE UNIQUE INDEX "cash_handovers_point_handover_date_dispatcher_confirmed_by_key" ON "cash_handovers"("point", "handover_date", "dispatcher_confirmed_by");
