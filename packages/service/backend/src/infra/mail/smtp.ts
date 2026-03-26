import { createTransport } from "nodemailer";
import { createLogger } from "../logger/index";

const log = createLogger("smtp");

export function sendSmtp(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return transport.sendMail(opts);
}

const port = Number(Bun.env.SMTP_PORT ?? 465);
const transport = createTransport({
  host: Bun.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: Bun.env.SMTP_USER,
    pass: Bun.env.SMTP_PASS,
  },
  logger: true,
  pool: true,
});

transport.verify().catch((err: unknown) => {
  log.warn({ err }, "SMTP server is not ready to send emails");
});

export function verifySmtp(): Promise<true> {
  return transport.verify();
}
