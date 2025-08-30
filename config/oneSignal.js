// config/onesignal.js
require("dotenv").config();
const Joi = require("joi");

const envSchema = Joi.object({
  NODE_ENV: Joi.string().default("development"),
  ONESIGNAL_APP_ID: Joi.string().required(),
  ONESIGNAL_REST_API_KEY: Joi.string().required(),
  ONESIGNAL_API_BASE: Joi.string().uri().default("https://api.onesignal.com"),
  ONESIGNAL_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
}).unknown(true);

const { value: env, error } = envSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
});

if (error) {
  // Fail fast in production if config is invalid
  // eslint-disable-next-line no-console
  console.error("❌ OneSignal config validation error:", error.details.map(d => d.message).join(", "));
  process.exit(1);
}

const oneSignalConfig = {
  appId: env.ONESIGNAL_APP_ID,
  restApiKey: env.ONESIGNAL_REST_API_KEY,
  baseURL: env.ONESIGNAL_API_BASE.replace(/\/+$/, ""), // trim trailing slash
  timeoutMs: Number(env.ONESIGNAL_TIMEOUT_MS),
  isProd: env.NODE_ENV === "production",
};

module.exports = oneSignalConfig;
