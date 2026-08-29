export function isStaleServerAction(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("was not found on the server") ||
    message.includes("Failed to find Server Action") ||
    message.includes("Server Action") && message.includes("not found")
  );
}

export function actionErrorMessage(
  err: unknown,
  fallback = "Something went wrong"
): string {
  if (isStaleServerAction(err)) {
    return "The app was updated. Refresh this page and try again.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
