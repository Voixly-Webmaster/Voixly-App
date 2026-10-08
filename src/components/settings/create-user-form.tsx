"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { createUser } from "@/actions/users";
import { actionErrorMessage } from "@/lib/action-error";
import { Loader2, RefreshCw } from "lucide-react";

function generatePassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function CreateUserForm() {
  const { success, error } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [role, setRole] = React.useState("STAFF");
  const [password, setPassword] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid max-w-3xl gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const result = await createUser(formData);
            if ("error" in result) {
              error("Could not create user", result.error);
              return;
            }
            success(
              "User created",
              "Share the password with them securely. It won't be shown again."
            );
            formRef.current?.reset();
            setPassword("");
            setRole("STAFF");
          } catch (err) {
            error("Could not create user", actionErrorMessage(err));
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="new-user-name">Name</Label>
        <Input id="new-user-name" name="name" required placeholder="Jane Smith" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-user-email">Email</Label>
        <Input
          id="new-user-email"
          name="email"
          type="email"
          required
          placeholder="jane@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-user-role">Role</Label>
        <select
          id="new-user-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="STAFF">Staff — assigned clients only</option>
          <option value="ADMIN">Admin — full access</option>
        </select>
      </div>
      <div className="hidden sm:block" aria-hidden />
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="new-user-password">Temporary password</Label>
        <div className="flex gap-2">
          <Input
            id="new-user-password"
            name="password"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setPassword(generatePassword())}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Copy it before saving — passwords are stored hashed and can&apos;t be
          viewed later.
        </p>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Create user
        </Button>
      </div>
    </form>
  );
}
