import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { FormPanel } from "@/components/shared/form-panel";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils";
import { intervalLabel } from "@/lib/billing";
import { CreateProductForm } from "@/components/settings/create-product-form";
import {
  ProductEditForm,
  ProductStatusActions,
} from "@/components/settings/product-row-actions";
import { Package } from "lucide-react";

export const metadata: Metadata = {
  title: "Products",
  description: "Catalog of recurring products and website leases.",
};

export default async function ProductsSettingsPage() {
  await requireAdminRole();

  const products = await prisma.product.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <FormPanel
        title="Add product"
        description="Catalog items that fill in a recurring invoice when you bill a client"
        icon={Package}
      >
        <CreateProductForm />
      </FormPanel>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add Custom Website Lease or any retainer you bill regularly."
        />
      ) : (
        <DataTable headers={["Product", "Price", "Interval", "Status", ""]}>
          {products.map((product) => {
            const archived = !(product.active && !product.deletedAt);
            return (
              <DataTableRow key={product.id}>
                <DataTableCell>
                  <ProductEditForm
                    id={product.id}
                    name={product.name}
                    description={product.description ?? ""}
                    amount={(product.amountCents / 100).toFixed(2)}
                    interval={product.interval}
                  />
                </DataTableCell>
                <DataTableCell className="tabular-nums">
                  {formatCurrency(product.amountCents)}
                </DataTableCell>
                <DataTableCell className="capitalize">
                  {intervalLabel(product.interval)}
                </DataTableCell>
                <DataTableCell>
                  {archived ? (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  ) : (
                    <span className="text-xs font-medium text-success-foreground">
                      Active
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-right">
                  <ProductStatusActions
                    id={product.id}
                    name={product.name}
                    archived={archived}
                  />
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
