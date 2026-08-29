"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/panel";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Panel
        title="Something went wrong"
        description="We couldn't load this page. Try again, or go back to the dashboard."
        accent="primary"
        className="max-w-md shadow-lg"
      >
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
