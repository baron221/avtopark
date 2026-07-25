# Handoff: Avtopark Foyda Tizimi (Farg'ona–Quva)

## Overview
Fleet profit-tracking system for a transport company running ~20 vehicles (buses/vans) on the Farg'ona–Quva route. Tracks 3 income streams (per-trip revenue, daily plan payments, monthly rentals), all expenses, payroll (salary + bonus − advance − fines − lunches), fuel-station contracts, and driver shift rotation. 6 user roles with strict per-role data scoping.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, NOT production code to copy directly. Recreate these designs in your target stack (e.g. React/Next.js + PostgreSQL, or whatever you choose) using its established patterns. The `.dc.html` files open directly in a browser for reference.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-close. The chosen direction is **variant 1a "Indigo"** (sections 2a/3a/4a extend it); variants 1b (dark/lime) and 1c (warm) are alternative explorations kept for reference.

## Roles & Access Control
Six roles: `ADMIN`, `OWNER` (egasi), `ACCOUNTANT` (buxgalter), `DISPATCHER` (dispetcher), `MECHANIC` (mexanik), `DRIVER` (haydovchi).

Core rule: **every user sees only their own scope.**
- Dispatcher is bound to a point (`users.point`: FARGONA | QUVA) — filters everything by `WHERE point = current_user.point`. Farg'ona dispatcher never sees Quva data.
- Driver sees only own shifts/trips/payroll line.
- Mechanic owns vehicles (add/manage) + fuel logs + station payments.
- Accountant owns payroll: salary, advances, fines, lunches, net profit.
- Owner: read-only dashboards over the whole fleet.
- Admin: everything + user/role management.

Full matrix is in the design: screen "3a Kirish huquqlari" (6 roles × 9 modules: ✓ / faqat o'ziniki / —).

## Screens (all in `Avtopark Foyda.dc.html`, labeled via data-screen-label)
Turn 4 (top) — responsive/mobile:
- **4a Telefon — buxgalter vedomost** — payroll as cards, KPI chips, bottom tab bar
- **4a Telefon — dispetcher kirim-chiqim** — day balance card, +Kirim/−Chiqim buttons, journal feed
- **4a Telefon — mexanik** — station contracts as cards, fuel log, "+ Quyish yozuvi"
- **4a Telefon — admin** — staff counts, user list cards
- **4a Planshet — egasi** — 768px 2-column owner dashboard

Turn 3 — role screens (desktop, indigo):
- **3a Admin — foydalanuvchilar** — user table: role badges, phone (login), Parol/Bloklash actions
- **3a Kirish huquqlari** — role-access matrix
- **3a Smena boshqaruvi** — per-vehicle morning/evening driver assignment, shift toggle 06:00–14:00 / 14:00–22:00
- **3a Buxgalter — oylik hisob** — payroll ledger: Maosh | Avans | Jarima | Obed | Bonus | Qo'lga tegadi; KPIs (fond, avanslar, jarimalar, obed, sof foyda); "+ Avans berish", Excel export, approve
- **3a Dispetcher — pul yig'ish** — point badge (📍 Farg'ona), collected today, vehicles received 5/11, own rasxod/obed, per-vehicle money intake form
- **3a Dispetcher — kirim-chiqim** — KIRIM: Reys | Alohida zakaz; CHIQIM: Stoyanka | Obed | Shaxsiy oziq-ovqat | Boshqa rasxod; day journal with running balance
- **3a Mexanik — yoqilg'i** — station contracts (volume, amount, pay status), grand total, fuel log per vehicle/driver

Turn 2 — core screens in all 3 style variants (2a is canonical):
- Login (phone + password, role auto-detected)
- Xarajat kiritish (mobile form: vehicle, category chips, amount, note)
- Mashinalar ro'yxati (filters Barchasi/Liniyada/Ijarada/Ta'mirda; **owned by MECHANIC**, owner read-only)
- Mashina sahifasi (per-vehicle KPIs + expense history)
- Haydovchilar (trips, plan %, salary, net contribution)
- Oylik hisobot (income sources, expense categories, Excel/PDF export; owner only)

Turn 1 — dashboards (3 variants):
- Owner desktop dashboard (KPI row, weekly chart, expense breakdown, vehicle profit table)
- Driver phone app (plan progress, trip entry, today's trips)
- Trip entry form (direction toggle Farg'ona→Quva, amount, passenger stepper)

## Data Model
Full schema in `Malumotlar Sxemasi.dc.html` — **17 tables + 9 view models**, with relationships and formulas. Key tables: users (role, point), vehicles, drivers, routes, trips, daily_plans, plan_payments, rentals, expenses, shifts, fines, lunches, fuel_stations, fuel_logs, station_payments, staff_expenses, salaries. Add `advances` (user_id, amount, given_date, month, entered_by) — the payroll screen already shows an Avans column.

Formulas:
```
tushum(vehicle, period) = Σ trips.revenue + Σ daily_plans.paid_amount + rental_prorata
xarajat(vehicle, period) = Σ expenses.amount (FUEL|SALARY|REPAIR|INSURANCE|TAX|TOLL|OTHER)
sof_foyda = tushum − xarajat
net_pay = base_salary + bonus − advances − fines − lunches
plan_status = paid ≥ plan ? FULL : paid > 0 ? PARTIAL : PENDING
```

Dispatcher income kinds: `TRIP | ORDER` (alohida zakaz). Dispatcher expense categories: `STOYANKA | OBED | OZIQ_OVQAT | BOSHQA`.

## Design Tokens (variant 1a — Indigo)
Colors:
- Primary: `#4F46E5` (indigo) · primary tint bg: `#EEF0F8`
- Page bg: `#F6F7FB` · card bg: `#fff` · border: `#E7E8F0` · row divider: `#F0F1F7`
- Text: `#1E1F2B` (heading) · `#4A4B5C` (body) · `#6B6D82` / `#8A8CA0` (muted)
- Success: `#1B9E6B` on `#E4F5EC` · Danger: `#D9534F` on `#FDECEA` · Warning: `#B26A00` on `#FFF3E0` · Accent: `#FFB84D`
- Phone frame border: `#1E1F2B` (8px, radius 36px)

Typography:
- Headings/numbers: **Space Grotesk** 700 (Google Fonts)
- UI text: **Manrope** 400–800
- Table headers: 12px/800, uppercase, letter-spacing .04em
- Body/table cells: 13–14px; card KPI numbers 24–30px; mobile min hit target 44px

Shape & spacing:
- Cards: radius 14–20px, border 1px `#E7E8F0`, shadow `0 12px 40px rgba(30,31,43,.14)`
- Status pills: radius 20px, 12px/800
- Buttons: radius 10–14px, weight 800
- Grid gaps: 14–20px desktop, 8–14px mobile

## Interactions & Behavior
- Login by phone + password; role and point resolved server-side, route to role home
- Period toggle (Kun/Hafta/Oy) re-aggregates all dashboard queries
- Responsive: ≥1024px tables; <1024px tables collapse to cards + bottom tab bar (see 4a screens); tablet ~768px = 2-column grid
- Numbers formatted with thin spaces (260 000), profits prefixed +/− and colored (green/red)
- Trip entry: suggestedRevenue = base_fare × passenger_count, editable
- Payroll: DRAFT → APPROVED → PAID; fines/lunches/advances auto-deducted
- Audit: every insert stores `entered_by`

## Assets
No external images. Icons are unicode glyphs (◉ ▤ ◈ ▥ ▨, 📍) — replace with your icon library (e.g. lucide). Fonts from Google Fonts.

## Files
- `Avtopark Foyda.dc.html` — all screens (turns 4→1, newest on top)
- `Malumotlar Sxemasi.dc.html` — DB schema + view models + formulas
- `Taqdimot.dc.html` — 7-slide client pitch deck (context only)
- `support.js` — prototype runtime (ignore for implementation)
