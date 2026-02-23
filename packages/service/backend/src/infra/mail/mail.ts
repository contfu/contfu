import { createLogger } from "../logger/index";
import { renderMailHtml } from "./mail-rendering";

const log = createLogger("mail");

const { sendSmtp } =
  Bun.env.SMTP_HOST == null
    ? { sendSmtp: ({ html = "" }) => log.debug({ html }, "Email (no SMTP configured)") }
    : Bun.env.SMTP_HOST === "smtp.ethereal.email"
      ? await import("./smtp-ethereal")
      : Bun.env.SMTP_HOST === ""
        ? { sendSmtp: () => {} }
        : await import("./smtp");

const fromEmail = Bun.env.SMTP_FROM_EMAIL ?? Bun.env.SMTP_USER ?? "mail@pumpit.cloud";
const fromName = Bun.env.SMTP_FROM_NAME ?? "Pumpit";
export const origin = Bun.env.ORIGIN ?? "https://localhost:5173";

const from = `"${fromName}" <${fromEmail}>`;

export async function sendEmail(to: string, subject: string, content: string, text: string) {
  const html = renderMailHtml(content);
  await sendSmtp({ from, to, subject, html, text });
}
