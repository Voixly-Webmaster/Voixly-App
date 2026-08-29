import { PrismaClient, UserRole, InvoiceStatus, TaskStatus, TicketStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@voixly.com" },
    update: { passwordHash, deletedAt: null, role: UserRole.ADMIN },
    create: {
      email: "admin@voixly.com",
      name: "Admin User",
      role: UserRole.ADMIN,
      passwordHash,
      staffProfile: { create: { title: "Operations Lead" } },
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@voixly.com" },
    update: { passwordHash, deletedAt: null, role: UserRole.STAFF },
    create: {
      email: "staff@voixly.com",
      name: "Staff Member",
      role: UserRole.STAFF,
      passwordHash,
      staffProfile: { create: { title: "Account Manager" } },
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@acme.com" },
    update: { passwordHash, deletedAt: null, role: UserRole.CLIENT },
    create: {
      email: "client@acme.com",
      name: "Jane Acme",
      role: UserRole.CLIENT,
      passwordHash,
      clientProfile: {
        create: {
          companyName: "Acme Corp",
          contactName: "Jane Acme",
          phone: "+1 555-0100",
        },
      },
    },
    include: { clientProfile: true },
  });

  const clientId = clientUser.clientProfile!.id;
  const staffProfile = await prisma.staffProfile.findUnique({
    where: { userId: staff.id },
  });

  if (staffProfile) {
    await prisma.staffClientAssignment.upsert({
      where: {
        staffId_clientId: { staffId: staffProfile.id, clientId },
      },
      update: {},
      create: { staffId: staffProfile.id, clientId },
    });
  }

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-00001" },
    update: {},
    create: {
      clientId,
      invoiceNumber: "INV-00001",
      title: "Website retainer — May",
      description: "Monthly website maintenance and support",
      amountCents: 150000,
      status: InvoiceStatus.SENT,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      sentAt: new Date(),
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-00002" },
    update: {},
    create: {
      clientId,
      invoiceNumber: "INV-00002",
      title: "SEO campaign — Q2",
      amountCents: 250000,
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
      sentAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      clientId,
      subject: "Question about May invoice",
      status: TicketStatus.OPEN,
      messages: {
        create: {
          authorId: clientUser.id,
          body: "Hi — can you confirm what is included in the May retainer?",
          isStaff: false,
        },
      },
    },
  });

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  await prisma.task.create({
    data: {
      clientId,
      title: "Homepage redesign review",
      description: "Client review of updated homepage mockups",
      status: TaskStatus.IN_PROGRESS,
      priority: "high",
      scheduledDate: today,
      clientVisible: true,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
      assigneeId: staff.id,
    },
  });

  await prisma.dailyWin.create({
    data: {
      text: "Send Acme homepage mockups for approval",
      goalDate: today,
      userId: staff.id,
      completed: false,
    },
  });

  await prisma.dailyWin.create({
    data: {
      text: "Review Q2 invoice batch",
      goalDate: today,
      userId: admin.id,
      completed: true,
    },
  });

  await prisma.task.create({
    data: {
      title: "Weekly internal standup prep",
      description: "Prepare agenda for team sync",
      status: TaskStatus.NEW,
      priority: "medium",
      scheduledDate: today,
      createdById: admin.id,
      assigneeId: admin.id,
    },
  });

  await prisma.announcement.create({
    data: {
      title: "Welcome to ClientHub",
      body: "Your new client portal is live. Use Billing to pay invoices, Support for questions, and Projects for updates on your account.",
      published: true,
      publishAt: new Date(),
    },
  });

  await prisma.clientNote.create({
    data: {
      clientId,
      authorId: admin.id,
      body: "Key contact — prefers email over phone. Decision maker for marketing spend.",
      pinned: true,
    },
  });

  console.log("Seed complete:");
  console.log("  Admin:  admin@voixly.com / password123");
  console.log("  Staff:  staff@voixly.com / password123");
  console.log("  Client: client@acme.com / password123");
  console.log(`  Sample ticket: ${ticket.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
