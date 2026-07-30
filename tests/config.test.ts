import { describe,expect,it } from "vitest";
import { loadConfig } from "../src/config.js";
const valid={DATABASE_URL:"postgresql://localhost/x",SESSION_SECRET:"0123456789abcdef",ADMIN_EMAIL:"admin@example.cz",ADMIN_PASSWORD:"strong-password",DEVICE_API_KEY:"0123456789abcdef"};
describe("konfigurace",()=>{it("odmítne krátká tajemství",()=>expect(()=>loadConfig({...valid,SESSION_SECRET:"short"})).toThrow());it("doplní bezpečné výchozí hodnoty",()=>expect(loadConfig(valid).APP_TIMEZONE).toBe("Europe/Prague"))});
