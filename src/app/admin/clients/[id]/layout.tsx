import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { ClientSubnav } from "@/components/clients/client-subnav";

export default async function AdminClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!(await canAccessClient(user, id))) notFound();

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    select: { companyName: true },
  });
  if (!client) notFound();

  return (
    <div>
      <ClientSubnav clientId={id} companyName={client.companyName} />
      {children}
    </div>
  );
}
