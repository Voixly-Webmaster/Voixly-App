import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { FormPanel } from "@/components/shared/form-panel";
import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { selectClassName } from "@/lib/ui";
import { formatCurrency } from "@/lib/utils";
import { intervalLabel } from "@/lib/billing";
import { createProduct, updateProduct, setProductActive } from "@/actions/products";
import { Package } from "lucide-react";

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
        <form action={createProduct} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Name</Label>
            <Input id="product-name" name="name" required placeholder="SEO retainer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-amount">Amount (USD)</Label>
            <Input
              id="product-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-interval">Interval</Label>
            <select
              id="product-interval"
              name="interval"
              className={selectClassName}
              defaultValue="MONTHLY"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="product-description">Description</Label>
            <Input id="product-description" name="description" />
          </div>
          <div className="flex items-end">
            <Button type="submit">Add product</Button>
          </div>
        </form>
      </FormPanel>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add Custom Website Lease or any retainer you bill regularly."
        />
      ) : (
        <DataTable headers={["Product", "Price", "Interval", "Status", ""]}>
          {products.map((product) => (
            <DataTableRow key={product.id}>
              <DataTableCell>
                <form action={updateProduct} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="id" value={product.id} />
                  <Input name="name" defaultValue={product.name} required />
                  <Input
                    name="description"
                    defaultValue={product.description ?? ""}
                    placeholder="Description"
                  />
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={(product.amountCents / 100).toFixed(2)}
                  />
                  <select
                    name="interval"
                    className={selectClassName}
                    defaultValue={product.interval}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                  <Button type="submit" variant="outline" size="sm" className="sm:col-span-2 w-fit">
                    Save
                  </Button>
                </form>
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                {formatCurrency(product.amountCents)}
              </DataTableCell>
              <DataTableCell className="capitalize">
                {intervalLabel(product.interval)}
              </DataTableCell>
              <DataTableCell>
                {product.active && !product.deletedAt ? (
                  <span className="text-xs font-medium text-success-foreground">Active</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Archived</span>
                )}
              </DataTableCell>
              <DataTableCell className="text-right">
                <form action={setProductActive}>
                  <input type="hidden" name="id" value={product.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={product.active && !product.deletedAt ? "false" : "true"}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    {product.active && !product.deletedAt ? "Archive" : "Restore"}
                  </Button>
                </form>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
