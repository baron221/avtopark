import "dotenv/config";
import { PrismaClient, VehicleType, VehicleStatus, SalaryType, ExpenseCategory, PlanStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "parol123";

const FIRST_NAMES = [
  "Baxtiyor", "Shuhrat", "Dilshod", "Aziz", "Sardor", "Jasur", "Bobur", "Ulug'bek",
  "Otabek", "Farrux", "Islom", "Rustam", "Doston", "Sherzod", "Akmal", "Nodir",
  "Elyor", "Diyor", "Anvar", "Kamol",
];
const LAST_NAMES = [
  "Karimov", "Rashidov", "Tursunov", "Yusupov", "Ergashev", "Nazarov", "Mamatov",
  "Qodirov", "Xolmatov", "Saidov", "Abdullayev", "Ismoilov", "Nurmatov", "Rahimov",
];

function randomName(seed: number) {
  return `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[seed % LAST_NAMES.length]}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ---- Route ----
  const route = await prisma.route.create({
    data: {
      fromCity: "Farg'ona",
      toCity: "Quva",
      distanceKm: 42,
      baseFare: 20000,
      isActive: true,
    },
  });

  // ---- Role test users (fixed phones for easy login) ----
  const owner = await prisma.user.create({
    data: { fullName: "Baxtiyor aka", phone: "+998901111101", role: "OWNER", passwordHash },
  });
  const admin = await prisma.user.create({
    data: { fullName: "Alisher Adminov", phone: "+998901111102", role: "ADMIN", baseSalary: 4_000_000, passwordHash },
  });
  await prisma.user.create({
    data: {
      fullName: "Malika Buxgalterova",
      phone: "+998901111103",
      role: "ACCOUNTANT",
      baseSalary: 3_500_000,
      passwordHash,
    },
  });
  await prisma.user.create({
    data: {
      fullName: "Sanjar Dispetcherov",
      phone: "+998901111104",
      role: "DISPATCHER",
      point: "FARGONA",
      baseSalary: 2_500_000,
      passwordHash,
    },
  });
  await prisma.user.create({
    data: {
      fullName: "Ikrom Quvayev",
      phone: "+998901111107",
      role: "DISPATCHER",
      point: "QUVA",
      baseSalary: 2_500_000,
      passwordHash,
    },
  });
  const mechanic = await prisma.user.create({
    data: {
      fullName: "Ravshan Mexanikov",
      phone: "+998901111105",
      role: "MECHANIC",
      baseSalary: 2_700_000,
      passwordHash,
    },
  });

  // ---- 20 vehicles ----
  const VEHICLE_COUNT = 20;
  const vehicles = [];
  for (let i = 0; i < VEHICLE_COUNT; i++) {
    const type: VehicleType = i % 3 === 0 ? "FURGON" : "AVTOBUS";
    let status: VehicleStatus = "ACTIVE";
    if (i === 16 || i === 17) status = "REPAIR";
    if (i === 18 || i === 19) status = "RENTED";
    const point = i < 11 ? "FARGONA" : "QUVA";

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: `01 A ${String(100 + i)} BA`,
        model: type === "AVTOBUS" ? "Isuzu HC40" : "GAZel Next",
        type,
        seats: type === "AVTOBUS" ? 40 : 16,
        status,
        point,
        purchasePrice: BigInt(type === "AVTOBUS" ? 320_000_000 : 180_000_000),
        purchaseDate: daysAgo(400),
      },
    });
    vehicles.push(vehicle);
  }

  // ---- Drivers for vehicles 0..17 (test driver is vehicle 0) ----
  const driverByVehicleIndex: Record<number, { driverId: string; userId: string; name: string }> = {};

  for (let i = 0; i <= 17; i++) {
    const isTestDriver = i === 0;
    const user = await prisma.user.create({
      data: {
        fullName: isTestDriver ? "Sherzod Haydovchiyev" : randomName(i),
        phone: isTestDriver ? "+998901111106" : `+99890${2000000 + i}`,
        role: "DRIVER",
        baseSalary: 3_000_000,
        passwordHash,
      },
    });
    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        vehicleId: vehicles[i].id,
        licenseNo: `FA${1000 + i}`,
        salaryType: "FIXED" as SalaryType,
        salaryValue: 3_000_000,
        hiredAt: daysAgo(300),
      },
    });
    driverByVehicleIndex[i] = { driverId: driver.id, userId: user.id, name: user.fullName };
  }

  // ---- Rentals for vehicles 18, 19 ----
  await prisma.rental.create({
    data: {
      vehicleId: vehicles[18].id,
      renterName: "Farrux Renterov",
      renterPhone: "+998901112001",
      monthlyAmount: 3_500_000,
      startDate: daysAgo(90),
      endDate: null,
      status: "ACTIVE",
    },
  });
  await prisma.rental.create({
    data: {
      vehicleId: vehicles[19].id,
      renterName: "Otabek Renterov",
      renterPhone: "+998901112002",
      monthlyAmount: 3_200_000,
      startDate: daysAgo(60),
      endDate: null,
      status: "ACTIVE",
    },
  });

  // ---- Trips: vehicles 0..12 (TRIPS income source), last 60 days ----
  for (let i = 0; i <= 12; i++) {
    const { driverId } = driverByVehicleIndex[i];
    for (let d = 0; d < 60; d++) {
      const tripsToday = randInt(2, 5);
      for (let t = 0; t < tripsToday; t++) {
        const passengerCount = randInt(8, 16);
        await prisma.trip.create({
          data: {
            vehicleId: vehicles[i].id,
            driverId,
            routeId: route.id,
            point: vehicles[i].point!,
            tripDate: daysAgo(d),
            departureTime: daysAgo(d),
            passengerCount,
            revenue: BigInt(passengerCount * route.baseFare),
            enteredBy: driverId === driverByVehicleIndex[0].driverId ? owner.id : admin.id,
          },
        });
      }
    }
  }

  // ---- Daily plans: vehicles 13..15 (PLAN income source), last 60 days ----
  for (let i = 13; i <= 15; i++) {
    const { driverId } = driverByVehicleIndex[i];
    const planAmount = 350_000;
    for (let d = 0; d < 60; d++) {
      const roll = Math.random();
      const paidAmount = roll < 0.7 ? planAmount : roll < 0.9 ? randInt(100_000, 300_000) : 0;
      const status: PlanStatus = paidAmount >= planAmount ? "FULL" : paidAmount > 0 ? "PARTIAL" : "PENDING";
      await prisma.dailyPlan.create({
        data: {
          vehicleId: vehicles[i].id,
          driverId,
          planDate: daysAgo(d),
          planAmount: BigInt(planAmount),
          paidAmount: BigInt(paidAmount),
          status,
          paidAt: paidAmount > 0 ? daysAgo(d) : null,
        },
      });
    }
  }

  // ---- Expenses: all vehicles, scattered over last 60 days ----
  const categories: ExpenseCategory[] = ["FUEL", "REPAIR", "INSURANCE", "TAX", "TOLL", "OTHER"];
  for (const vehicle of vehicles) {
    const expenseDays = randInt(15, 30);
    for (let e = 0; e < expenseDays; e++) {
      const day = randInt(0, 59);
      const category = categories[randInt(0, categories.length - 1)];
      const amount =
        category === "FUEL"
          ? randInt(150_000, 400_000)
          : category === "REPAIR"
            ? randInt(200_000, 2_000_000)
            : category === "INSURANCE"
              ? randInt(500_000, 900_000)
              : randInt(30_000, 200_000);
      await prisma.expense.create({
        data: {
          vehicleId: vehicle.id,
          category,
          amount: BigInt(amount),
          expenseDate: daysAgo(day),
          note: null,
          enteredBy: mechanic.id,
        },
      });
    }
  }

  // ---- Fuel stations + station payments + fuel logs ----
  const stationAvtoGaz = await prisma.fuelStation.create({
    data: {
      name: "Avto Gaz Servis",
      fuelType: "METAN",
      contractNo: "Shartnoma №14",
      unitPrice: 1500,
      payPeriod: "HALF_MONTH",
      isActive: true,
    },
  });
  const stationNeftgaz = await prisma.fuelStation.create({
    data: {
      name: "Neftgaz Zapravka",
      fuelType: "BENZIN",
      contractNo: "Shartnoma №08",
      unitPrice: 2243,
      payPeriod: "HALF_MONTH",
      isActive: true,
    },
  });
  const stationQuvaMetan = await prisma.fuelStation.create({
    data: {
      name: "Quva Metan",
      fuelType: "METAN",
      contractNo: "Shartnoma №21",
      unitPrice: 1500,
      payPeriod: "HALF_MONTH",
      isActive: true,
    },
  });

  const periodStart = daysAgo(14);
  const periodEnd = daysAgo(0);
  await prisma.stationPayment.create({
    data: {
      stationId: stationAvtoGaz.id,
      periodStart,
      periodEnd,
      totalVolume: 4260,
      amount: 6_390_000,
      status: "PAID",
      paidAt: daysAgo(1),
      enteredBy: mechanic.id,
    },
  });
  await prisma.stationPayment.create({
    data: {
      stationId: stationNeftgaz.id,
      periodStart,
      periodEnd,
      totalVolume: 1840,
      amount: 4_128_000,
      status: "PENDING",
      paidAt: null,
      enteredBy: mechanic.id,
    },
  });
  await prisma.stationPayment.create({
    data: {
      stationId: stationQuvaMetan.id,
      periodStart,
      periodEnd,
      totalVolume: 2950,
      amount: 4_425_000,
      status: "PAID",
      paidAt: daysAgo(2),
      enteredBy: mechanic.id,
    },
  });

  const fuelLogVehicles = [0, 1, 6, 5];
  const fuelStationsCycle = [stationAvtoGaz, stationAvtoGaz, stationNeftgaz, stationQuvaMetan];
  for (let i = 0; i < fuelLogVehicles.length; i++) {
    const vIdx = fuelLogVehicles[i];
    const { driverId } = driverByVehicleIndex[vIdx];
    const station = fuelStationsCycle[i];
    const volume = station.fuelType === "BENZIN" ? 38 : 118 + i * 4;
    await prisma.fuelLog.create({
      data: {
        stationId: station.id,
        vehicleId: vehicles[vIdx].id,
        driverId,
        volume,
        amount: BigInt(Math.round(volume * Number(station.unitPrice))),
        filledAt: daysAgo(i),
        enteredBy: mechanic.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Test accounts (password: parol123):");
  console.log("  OWNER      +998901111101");
  console.log("  ADMIN      +998901111102");
  console.log("  ACCOUNTANT +998901111103");
  console.log("  DISPATCHER +998901111104 (Farg'ona)");
  console.log("  DISPATCHER +998901111107 (Quva)");
  console.log("  MECHANIC   +998901111105");
  console.log("  DRIVER     +998901111106");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
