import { Context, Effect, Layer } from "effect";

export class Mail extends Context.Tag("@contfu/Mail")<
  Mail,
  {
    readonly sendEmail: (
      to: string,
      subject: string,
      content: string,
      text: string,
    ) => Effect.Effect<void>;
  }
>() {}

/**
 * Production layer — wraps the existing mail module.
 */
export const MailLive = Layer.effect(
  Mail,
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/mail/mail"),
      catch: (e) => new Error(`Failed to load mail module: ${e}`),
    });

    return {
      sendEmail: (to: string, subject: string, content: string, text: string) =>
        Effect.tryPromise({
          try: () => mod.sendEmail(to, subject, content, text),
          catch: (e) => new Error(`Failed to send email: ${e}`),
        }).pipe(Effect.withSpan("mail.send", { attributes: { to, subject } }), Effect.orDie),
    };
  }),
);
