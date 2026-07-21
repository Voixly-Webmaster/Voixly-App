"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { selectClassName } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterSelect({
  paramName,
  options,
  placeholder = "All",
  ariaLabel,
}: {
  paramName: string;
  options: FilterOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const value = searchParams.get(paramName) ?? "";

  return (
    <select
      aria-label={ariaLabel ?? paramName}
      className={cn(selectClassName, "h-10 max-w-[200px]", isPending && "opacity-70")}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (next) params.set(paramName, next);
        else params.delete(paramName);
        params.delete("page");
        const qs = params.toString();
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        });
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
