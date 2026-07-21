import { Panel } from "@/components/shared/panel";
import type { LucideIcon } from "lucide-react";

export function FormPanel({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel
      title={title}
      description={description}
      icon={icon}
      accent="secondary"
      className={className}
    >
      {children}
    </Panel>
  );
}
