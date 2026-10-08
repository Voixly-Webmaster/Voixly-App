const FONT = "Inter, Segoe UI, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailParagraphs(text: string): string {
  const chunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks
    .map((chunk, index) => {
      const margin = index === chunks.length - 1 ? "0" : "0 0 12px";
      return `<p style="margin:${margin};">${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function emailShell(params: {
  preheader: string;
  title: string;
  bodyHtml: string;
  button?: { href: string; label: string };
  footnote?: string;
}): string {
  const button = params.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
        <tr>
          <td style="border-radius:10px;background:#FF6B4A;">
            <a href="${escapeHtml(params.button.href)}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${escapeHtml(params.button.label)}</a>
          </td>
        </tr>
      </table>`
    : "";
  const footnote = params.footnote
    ? `<p style="margin:28px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#7b8794;">${escapeHtml(params.footnote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f0ec;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ec;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#0a0f14;padding:28px 32px 24px;">
                <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">Voixly</p>
                <p style="margin:8px 0 0;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#FF6B4A;">ClientHub</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#FF6B4A;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 28px;">
                <h1 style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#0a0f14;">${escapeHtml(params.title)}</h1>
                <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:#3d4a54;">${params.bodyHtml}</div>
                ${button}
                ${footnote}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:#94a3b8;">Voixly Digital Marketing</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function detailRows(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row, index) => `<tr>
        <td style="padding:12px 0;border-top:${index === 0 ? "0" : "1px solid #ece7e2"};font-family:${FONT};font-size:13px;color:#7b8794;width:110px;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:12px 0;border-top:${index === 0 ? "0" : "1px solid #ece7e2"};font-family:${FONT};font-size:15px;font-weight:600;color:#0a0f14;vertical-align:top;">${escapeHtml(row.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">${cells}</table>`;
}

export function quoteBlock(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr>
      <td style="padding:16px 18px;background:#f7f4f1;border-radius:12px;font-family:${FONT};font-size:15px;line-height:1.6;color:#3d4a54;">${html}</td>
    </tr>
  </table>`;
}

export function codeBlock(code: string): string {
  return `<p style="margin:20px 0 0;padding:18px 12px;background:#0a0f14;border-radius:12px;text-align:center;font-family:${FONT};font-size:32px;letter-spacing:0.28em;font-weight:700;color:#ffffff;">${escapeHtml(code)}</p>`;
}
