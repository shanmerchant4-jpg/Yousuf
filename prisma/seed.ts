import { PrismaClient, CustomerStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // --- owner login -----------------------------------------------------
  const email = process.env.SEED_EMAIL ?? "owner@isp.local";
  const password = process.env.SEED_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(password, 10);

  const owner = await db.staff.upsert({
    where: { email },
    update: {},
    create: { name: "Owner", email, passwordHash, role: "OWNER" },
  });
  console.log(`Owner login -> ${email} / ${password}`);

  // --- a few sample customers (only if DB empty) -----------------------
  const count = await db.customer.count();
  if (count === 0) {
    const today = new Date();
    const plus = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d;
    };

    const samples = [
      { fullName: "Ahmed Khan", phone: "03001234567", area: "Gulshan", panel: "1", packageName: "25 Mbps", monthlyFee: 1500, paidUntil: plus(20), status: CustomerStatus.ACTIVE },
      { fullName: "Bilal Raza", phone: "03007654321", area: "Defence", panel: "1", packageName: "30 Mbps", monthlyFee: 2000, paidUntil: plus(3), status: CustomerStatus.ACTIVE },
      { fullName: "Sana Malik", phone: "03331112222", area: "Model Town", panel: "2", packageName: "50 Mbps", monthlyFee: 3000, paidUntil: plus(-2), status: CustomerStatus.OVERDUE },
      { fullName: "Usman Tariq", phone: "03219998887", area: "Johar", panel: "2", packageName: "25 Mbps", monthlyFee: 1500, paidUntil: plus(-10), status: CustomerStatus.SUSPENDED },
    ];

    for (const s of samples) {
      const c = await db.customer.create({ data: s });
      await db.payment.create({
        data: {
          customerId: c.id,
          amount: s.monthlyFee,
          method: PaymentMethod.CASH,
          monthsCovered: 1,
          recordedById: owner.id,
        },
      });
    }
    console.log(`Seeded ${samples.length} sample customers.`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
