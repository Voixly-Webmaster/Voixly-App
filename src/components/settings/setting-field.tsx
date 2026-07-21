import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingStatus } from "@/lib/settings";

export function SettingField({
  status,
  label,
  placeholder,
  hint,
  type = "text",
}: {
  status: SettingStatus;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "email" | "url";
}) {
  const inputId = `setting-${status.key}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <SourceBadge status={status} />
      </div>
      {status.secret ? (
        <>
          <Input
            id={inputId}
            name={status.key}
            type="password"
            autoComplete="off"
            placeholder={
              status.isSet
                ? "•••••••• saved — leave blank to keep"
                : placeholder ?? "Not set"
            }
          />
          {status.source === "database" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name={`clear:${status.key}`} className="rounded" />
              Clear the saved value{status.secret ? " (reverts to .env if set)" : ""}
            </label>
          )}
        </>
      ) : (
        <Input
          id={inputId}
          name={status.key}
          type={type}
          defaultValue={status.value ?? ""}
          placeholder={placeholder}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SourceBadge({ status }: { status: SettingStatus }) {
  if (status.source === "database") {
    return (
      <span className="rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-medium text-success-foreground">
        Saved in settings
      </span>
    );
  }
  if (status.source === "environment") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        From .env
      </span>
    );
  }
  return (
    <span className="rounded-full bg-warning-muted px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
      Not set
    </span>
  );
}
