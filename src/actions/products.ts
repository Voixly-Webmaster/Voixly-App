"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { parseBillingInterval } from "@/lib/billing";
import { uniqueProductSlug } from "@/lib/product-slug";
import { logActivity } from "@/lib/activity";

const PRODUCTS_PATH = "/admin/settings/products";

export async function createProduct(formData: FormData) {
  const admin = await requireAdminRole();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = parseFloat(String(formData.get("amount") ?? ""));
  const interval = parseBillingInterval(formData.get("interval")) ?? "MONTHLY";

  if (!name) throw new Error("Product name is required");
  if (isNaN(amount) || amount <= 0) throw new Error("Enter a positive amount");

  const slug = await uniqueProductSlug(name, async (candidate) => {
    const row = await prisma.product.findUnique({ where: { slug: candidate } });
    return Boolean(row);
  });

  const product = await prisma.product.create({
    data: {
      slug,
      name,
      description,
      amountCents: Math.round(amount * 100),
      interval,
      active: true,
    },
  });

  await logActivity({
    actorId: admin.id,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    metadata: { name, amountCents: product.amountCents },
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath("/admin/invoices");
}

export async function updateProduct(formData: FormData) {
  await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = parseFloat(String(formData.get("amount") ?? ""));
  const interval = parseBillingInterval(formData.get("interval")) ?? "MONTHLY";

  if (!id) throw new Error("Product is required");
  if (!name) throw new Error("Product name is required");
  if (isNaN(amount) || amount <= 0) throw new Error("Enter a positive amount");

  await prisma.product.update({
    where: { id },
    data: {
      name,
      description,
      amountCents: Math.round(amount * 100),
      interval,
    },
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath("/admin/invoices");
}

export async function setProductActive(formData: FormData) {
  await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  const active = formData.get("active") === "true";
  if (!id) throw new Error("Product is required");

  await prisma.product.update({
    where: { id },
    data: {
      active,
      deletedAt: active ? null : new Date(),
    },
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath("/admin/invoices");
}

export async function deleteProduct(formData: FormData) {
  const admin = await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Product is required");

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error("Product not found");
  if (product.active && !product.deletedAt) {
    throw new Error("Archive this product before deleting it");
  }

  await prisma.product.delete({ where: { id } });

  await logActivity({
    actorId: admin.id,
    action: "product.deleted",
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name },
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath("/admin/invoices");
}
