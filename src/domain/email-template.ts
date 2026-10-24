/**
 * One HTML layout for every e-mail the app sends. Every piece of text that comes from a customer or a shop
 * is escaped first, so a name such as <script> is shown as text and can never run.
 */
export interface EmailLayout {
  shopName: string;
  /** The line shown in the inbox preview, after the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  button?: { label: string; url: string };
  /** Shown at the bottom: the shop's address, phone and any closing note. */
  footer: string[];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INK = "#171717";
const MUTED = "#5e5a53";
const PAPER = "#f3f0e9";
const CARD = "#fbfaf7";
const LINE = "#e4dfd4";

export function renderEmail(layout: EmailLayout): string {
  const e = escapeHtml;
  const details = (layout.details ?? [])
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid ${LINE};color:${MUTED};font-size:14px;width:38%;">${e(row.label)}</td>
          <td style="padding:10px 0;border-top:1px solid ${LINE};color:${INK};font-size:15px;">${e(row.value)}</td>
        </tr>`,
    )
    .join("");
  const paragraphs = layout.paragraphs
    .map((text) => `<p style="margin:0 0 14px;color:${INK};font-size:16px;line-height:1.55;">${e(text)}</p>`)
    .join("");
  const button = layout.button
    ? `<p style="margin:24px 0 8px;"><a href="${e(layout.button.url)}" style="display:inline-block;background:${INK};color:${PAPER};text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;">${e(layout.button.label)}</a></p>`
    : "";
  const footer = layout.footer
    .map((line) => `<p style="margin:0 0 4px;color:${MUTED};font-size:13px;line-height:1.5;">${e(line)}</p>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(layout.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(layout.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 20px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">${e(layout.shopName)}</p>
          <h1 style="margin:0 0 18px;color:${INK};font-size:28px;font-weight:normal;">${e(layout.heading)}</h1>
          ${paragraphs}
          ${details ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px;">${details}</table>` : ""}
          ${button}
          <hr style="border:0;border-top:1px solid ${LINE};margin:28px 0 16px;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
