module.exports = ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET", "testsecret"),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT", "testsalt"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT", "testsalt2"),
    },
  },
  // Disable rate limiting for E2E tests
  rateLimit: {
    enabled: false,
  },
});
