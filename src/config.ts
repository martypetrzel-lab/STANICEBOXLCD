import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(10),
  DEVICE_ID: z.string().default("stanicebox-01"),
  DEVICE_API_KEY: z.string().min(16),
  DEVICE_OFFLINE_SECONDS: z.coerce.number().default(120),
  APP_TIMEZONE: z.string().default("Europe/Prague"),
  LOCATION_NAME: z.string().default("Mstetice / Nehvizdy"),
  LOCATION_LATITUDE: z.coerce.number().default(50.142),
  LOCATION_LONGITUDE: z.coerce.number().default(14.727),
  WEATHER_CACHE_MINUTES: z.coerce.number().default(15),
  STATUS_HISTORY_INTERVAL_SECONDS: z.coerce.number().default(300),
  APP_BASE_URL: z.string().url().default("http://localhost:3000")
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env = process.env): Config {
  return schema.parse(env);
}
