import type { Metadata } from "next";
import Link from "next/link";
import { MessageCatalog } from "@/components/settings/message-catalog";
import { getMessageOverrides } from "@/lib/message-templates";

export const metadata: Metadata = {
  title: "Messages",
  description: "Email and text templates ClientHub sends.",
};

export default async function MessagesSettingsPage() {
  const overrides = await getMessageOverrides();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Messages</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every email and text ClientHub sends. The Voixly header stays the same. Placeholders such
          as {"{{name}}"} are filled in when the message goes out. Delivery keys stay in{" "}
          <Link href="/admin/settings/email" className="font-medium text-primary hover:underline">
            Email
          </Link>{" "}
          and{" "}
          <Link href="/admin/settings/sms" className="font-medium text-primary hover:underline">
            SMS
          </Link>
          .
        </p>
      </div>
      <MessageCatalog overrides={overrides} />
    </div>
  );
}
