import { createLogger } from "../logger/index";

const log = createLogger("mail");

const smtpEnabled = Bun.env.SMTP_HOST != null && Bun.env.SMTP_HOST !== "";

const { sendSmtp } = !smtpEnabled
  ? { sendSmtp: (_opts?: unknown) => log.debug("Email skipped (no SMTP configured)") }
  : Bun.env.SMTP_HOST === "smtp.ethereal.email"
    ? await import("./smtp-ethereal")
    : await import("./smtp");

const fromEmail = Bun.env.SMTP_FROM_EMAIL ?? Bun.env.SMTP_USER ?? "mail@contfu.com";
const fromName = Bun.env.SMTP_FROM_NAME ?? "Contfu";
export const origin = Bun.env.ORIGIN ?? "https://localhost:5173";

const from = `"${fromName}" <${fromEmail}>`;

export async function sendEmail(to: string, subject: string, content: string, text: string) {
  if (!smtpEnabled) return;
  // Dynamic import to avoid loading @css-inline/css-inline when SMTP is disabled.
  const { renderMailHtml } = await import("./mail-rendering");
  const html = renderMailHtml(content);
  await sendSmtp({ from, to, subject, html, text });
}
