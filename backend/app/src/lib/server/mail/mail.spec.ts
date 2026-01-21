import { describe, expect, it, mock } from "bun:test";

const mockSendMail = mock();

Bun.env.SMTP_HOST = "foobar.com";
Bun.env.SMTP_USER = "test@test.com";

mock.module("nodemailer", () => {
  return {
    createTransport: () => {
      return {
        sendMail: mockSendMail,
        verify: () => Promise.resolve(),
      };
    },
  };
});

const { sendEmail } = await import("./mail");
const { button } = await import("./mail-rendering");

describe("mail", () => {
  it("should send an email", async () => {
    await sendEmail(
      "test@test.com",
      "Test",
      `
        <h1>Test</h1>
        <p>Test</p>
        <a href="https://localhost:5173">Pumpit</a>
        ${button("Test", "https://localhost:5173")}
      `,
      "Test",
    );

    expect(mockSendMail.mock.calls).toMatchSnapshot();
  });
});
