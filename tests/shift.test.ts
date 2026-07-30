import { describe,expect,it } from "vitest";
import { shiftAt,yearStatistics } from "../src/services/shift.js";
describe("směny",()=>{
  it("začíná referenční směnou C",()=>expect(shiftAt(new Date("2026-01-01T05:00:00Z")).shift).toBe("C"));
  it("rotuje C A B",()=>{expect(shiftAt(new Date("2026-01-02T05:00:00Z")).shift).toBe("A");expect(shiftAt(new Date("2026-01-03T05:00:00Z")).shift).toBe("B")});
  it("mění směnu v 06:00 pražského času",()=>{expect(shiftAt(new Date("2026-01-02T04:59:59Z")).shift).toBe("C");expect(shiftAt(new Date("2026-01-02T05:00:00Z")).shift).toBe("A")});
  it("končí vždy v 06:00 i v létě",()=>{
    const end=shiftAt(new Date("2026-07-30T12:00:00Z")).end;
    expect(new Intl.DateTimeFormat("cs-CZ",{timeZone:"Europe/Prague",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(end)).toBe("06:00");
  });
  it("končí v 06:00 také při změně letního času",()=>{
    for(const instant of ["2026-03-28T12:00:00Z","2026-10-24T12:00:00Z"]){
      const end=shiftAt(new Date(instant)).end;
      expect(new Intl.DateTimeFormat("cs-CZ",{timeZone:"Europe/Prague",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(end)).toBe("06:00");
    }
  });
  it("spočítá celý rok",()=>expect(Object.values(yearStatistics(2026).counts).reduce((a,b)=>a+b,0)).toBe(365));
});
