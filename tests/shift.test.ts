import { describe,expect,it } from "vitest";
import { shiftAt,yearStatistics } from "../src/services/shift.js";
describe("směny",()=>{
  it("začíná referenční směnou C",()=>expect(shiftAt(new Date("2026-01-01T05:00:00Z")).shift).toBe("C"));
  it("rotuje C A B",()=>{expect(shiftAt(new Date("2026-01-02T05:00:00Z")).shift).toBe("A");expect(shiftAt(new Date("2026-01-03T05:00:00Z")).shift).toBe("B")});
  it("mění směnu v 06:00 pražského času",()=>{expect(shiftAt(new Date("2026-01-02T04:59:59Z")).shift).toBe("C");expect(shiftAt(new Date("2026-01-02T05:00:00Z")).shift).toBe("A")});
  it("spočítá celý rok",()=>expect(Object.values(yearStatistics(2026).counts).reduce((a,b)=>a+b,0)).toBe(365));
});
