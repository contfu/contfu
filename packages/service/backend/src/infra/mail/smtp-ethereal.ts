import { rm } from "node:fs/promises";
import { createTestAccount, createTransport, getTestMessageUrl } from "nodemailer";
import { createLogger } from "../logger/index";

const log = createLogger("smtp-ethereal");

export async function sendSmtp(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const info = await transport.sendMail(opts);
  const link = getTestMessageUrl(info);
  if (link) {
    void Bun.write(".tmp/last-sent-email-link.txt", link);
    log.info({ link }, "Ethereal email link");
  }
  return info;
}

log.warn("To send emails, provide SMTP configuration. Using ethereal.email for testing.");

void rm(".tmp/last-sent-email-link.txt", { force: true });

const { user, pass } = await createTestAccount();

const transport = createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: { user, pass },
  logger: true,
});
