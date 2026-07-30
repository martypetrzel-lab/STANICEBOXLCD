import { describe,expect,it } from "vitest";
import { loadConfig } from "../src/config.js";
const valid={SESSION_SECRET:"0123456789abcdef",ADMIN_USERNAME:"Hasici",ADMIN_PASSWORD:"150150",DEVICE_API_KEY:"0123456789abcdef"};
describe("konfigurace",()=>{it("odmítne krátká tajemství",()=>expect(()=>loadConfig({...valid,SESSION_SECRET:"short"})).toThrow());it("doplní bezpečné výchozí hodnoty",()=>expect(loadConfig(valid).APP_TIMEZONE).toBe("Europe/Prague"))});
