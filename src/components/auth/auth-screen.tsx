import Image from "next/image";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Panel } from "@/components/shared/panel";

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen app-main-bg">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="hidden flex-1 flex-col justify-between bg-brand p-12 text-brand-foreground lg:flex">
        <Image
          src="/brand/voixly-logo.png"
          alt="Voixly"
          width={160}
          height={48}
          className="brightness-0 invert"
          priority
        />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your work, in one place.
          </h1>
          <p className="mt-3 max-w-md text-brand-muted">
            Invoices, projects, files, and support — the secure Voixly portal
            for clients and the team behind them.
          </p>
        </div>
        <p className="text-sm text-brand-muted/80">© Voixly Digital Marketing</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 pt-16 sm:pt-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Image
              src="/brand/voixly-logomark.png"
              alt="Voixly"
              width={48}
              height={48}
              className="rounded-xl"
              priority
            />
          </div>
          <Panel title={title} description={description} accent="primary" className="shadow-lg">
            {children}
          </Panel>
        </div>
      </div>
    </div>
  );
}
