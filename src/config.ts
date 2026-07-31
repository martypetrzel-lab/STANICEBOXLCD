import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16).default("stanicebox-session-secret-2026"),
  ADMIN_USERNAME: z.string().default("Hasici"),
  ADMIN_PASSWORD: z.string().default("150150"),
  DEVICE_ID: z.string().default("stanicebox-01"),
  DEVICE_API_KEY: z.string().min(16).default("stanicebox-device-key-2026"),
  DEVICE_OFFLINE_SECONDS: z.coerce.number().default(120),
  APP_TIMEZONE: z.string().default("Europe/Prague"),
  LOCATION_NAME: z.string().default("Mstetice / Nehvizdy"),
  LOCATION_LATITUDE: z.coerce.number().default(50.142),
  LOCATION_LONGITUDE: z.coerce.number().default(14.727),
  WEATHER_CACHE_MINUTES: z.coerce.number().default(15),
  STATUS_HISTORY_INTERVAL_SECONDS: z.coerce.number().default(300),
  APP_BASE_URL: z.string().url().default("http://localhost:3000")
  ,CALENDAR_NOTIFICATION_LOOKAHEAD_DAYS: z.coerce.number().int().positive().default(90)
  ,CALENDAR_NOTIFICATION_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15)
  ,CALENDAR_DEFAULT_NOTIFY_BEFORE_MINUTES: z.coerce.number().int().nonnegative().default(1440)
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env = process.env): Config {
  return schema.parse(env);
}
