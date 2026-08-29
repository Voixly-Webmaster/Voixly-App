"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#f4f6f9] p-6 font-sans text-[#0f172a]">
        <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-lg">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            ClientHub hit an unexpected error. Refresh the page to continue.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-[#ff6b4a] px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
