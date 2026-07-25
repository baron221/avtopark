-- CreateIndex
CREATE INDEX "advances_user_id_month_idx" ON "advances"("user_id", "month");

-- CreateIndex
CREATE INDEX "advances_month_idx" ON "advances"("month");

-- CreateIndex
CREATE INDEX "daily_plans_driver_id_idx" ON "daily_plans"("driver_id");

-- CreateIndex
CREATE INDEX "daily_plans_plan_date_idx" ON "daily_plans"("plan_date");

-- CreateIndex
CREATE INDEX "expenses_vehicle_id_expense_date_idx" ON "expenses"("vehicle_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "fines_user_id_fine_date_idx" ON "fines"("user_id", "fine_date");

-- CreateIndex
CREATE INDEX "fuel_logs_vehicle_id_idx" ON "fuel_logs"("vehicle_id");

-- CreateIndex
CREATE INDEX "fuel_logs_station_id_idx" ON "fuel_logs"("station_id");

-- CreateIndex
CREATE INDEX "fuel_logs_filled_at_idx" ON "fuel_logs"("filled_at");

-- CreateIndex
CREATE INDEX "rentals_vehicle_id_idx" ON "rentals"("vehicle_id");

-- CreateIndex
CREATE INDEX "shifts_driver_id_idx" ON "shifts"("driver_id");

-- CreateIndex
CREATE INDEX "staff_expenses_user_id_expense_date_idx" ON "staff_expenses"("user_id", "expense_date");

-- CreateIndex
CREATE INDEX "staff_expenses_point_expense_date_idx" ON "staff_expenses"("point", "expense_date");

-- CreateIndex
CREATE INDEX "station_payments_station_id_idx" ON "station_payments"("station_id");

-- CreateIndex
CREATE INDEX "station_payments_period_end_idx" ON "station_payments"("period_end");

-- CreateIndex
CREATE INDEX "trips_vehicle_id_trip_date_idx" ON "trips"("vehicle_id", "trip_date");

-- CreateIndex
CREATE INDEX "trips_driver_id_idx" ON "trips"("driver_id");

-- CreateIndex
CREATE INDEX "trips_trip_date_idx" ON "trips"("trip_date");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_point_idx" ON "users"("point");

-- CreateIndex
CREATE INDEX "vehicles_point_idx" ON "vehicles"("point");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");
