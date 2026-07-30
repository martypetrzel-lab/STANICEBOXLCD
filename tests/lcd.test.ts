import { describe,expect,it } from "vitest";
import { removeDiacritics,wrapLcd } from "../src/services/lcd.js";
describe("LCD",()=>{
  it("odstraní českou diakritiku",()=>expect(removeDiacritics("Příliš žluťoučký kůň")).toBe("Prilis zlutoucky kun"));
  it("zalomí text na 20 znaků a čtyři řádky",()=>{const x=wrapLcd("Kontrola techniky proběhne dnes přesně v osmnáct hodin");expect(x.lines.length).toBeLessThanOrEqual(4);expect(x.lines.every(l=>l.length<=20)).toBe(true)});
  it("zachová přetečení pro posuvný text",()=>expect(wrapLcd("a ".repeat(100)).overflow.length).toBeGreaterThan(0));
});
