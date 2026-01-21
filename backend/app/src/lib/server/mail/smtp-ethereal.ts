import { rm } from "fs/promises";
import { createTestAccount, createTransport, getTestMessageUrl } from "nodemailer";

export async function sendSmtp(opts: { from: string; to: string; subject: string; html: string; text?: string }) {
  const info = await transport.sendMail(opts);
  const link = getTestMessageUrl(info);
  if (link) {
    Bun.write(".tmp/last-sent-email-link.txt", link);
    console.log("Ethereal email link:", link);
  }
  return info;
}

console.warn("To send emails, provide SMTP configuration. Using ethereal.email for testing.");

rm(".tmp/last-sent-email-link.txt", { force: true });

const { user, pass } = await createTestAccount();

const transport = createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: { user, pass },
  logger: true,
});
