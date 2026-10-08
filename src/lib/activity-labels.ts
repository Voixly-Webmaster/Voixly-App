const ACTION_LABELS: Record<string, string> = {
  "user.created": "Created user",
  "user.password_changed": "Changed password",
  "user.password_reset": "Reset a user's password",
  "user.two_factor_enabled": "Turned on sign-in codes",
  "user.two_factor_disabled": "Turned off sign-in codes",
  "settings.test_sms": "Sent a test text",
  "message.template_updated": "Updated a message template",
  "message.template_reset": "Restored a message template",
  "user.updated": "Updated user",
  "user.deactivated": "Deactivated user",
  "user.deleted": "Deleted user",
  "user.role_changed": "Changed user role",
  "client.created": "Created client",
  "client.updated": "Updated client",
  "ticket.created": "Opened ticket",
  "file.uploaded": "Uploaded file",
  "file.deleted": "Deleted file",
  "invoice.recurring_created": "Created recurring invoice",
  "invoice.recurring_cancelled": "Cancelled recurring invoice",
  "invoice.created": "Created invoice",
  "announcement.created": "Saved an announcement draft",
  "announcement.published": "Published an announcement",
  "announcement.unpublished": "Unpublished an announcement",
  "announcement.removed": "Removed an announcement",
  "product.created": "Created product",
  "product.deleted": "Deleted product",
};

export function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
