import { describe,expect,it } from "vitest";
import { lcdEventLines,recurrenceDates } from "../src/services/calendar.js";

const event={title:"Dovolená",eventType:"VACATION",startAt:new Date("2026-08-10T06:00:00+02:00"),endAt:new Date("2026-08-16T06:00:00+02:00"),person:{displayName:"Jan Novák"},shifts:[{shift:"B"}],recurrenceType:"NONE",recurrenceInterval:1};
describe("kalendář",()=>{
  it("vytvoří bezpečné řádky LCD",()=>{const lines=lcdEventLines(event);expect(lines).toHaveLength(4);expect(lines.every(x=>x.length<=20)).toBe(true);expect(lines[0]).toBe("DOVOLENA")});
  it("zachová vícedenní událost",()=>{const [x]=recurrenceDates(event,new Date("2026-08-01"),new Date("2026-09-01"));expect(x.end.getTime()-x.start.getTime()).toBe(6*86400000)});
  it("generuje denní opakování jen v zadaném okně",()=>{const x=recurrenceDates({...event,recurrenceType:"DAILY",recurrenceCount:3},new Date("2026-08-01"),new Date("2026-09-01"));expect(x).toHaveLength(3)});
  it("generuje týdenní opakování",()=>{const x=recurrenceDates({...event,recurrenceType:"WEEKLY",recurrenceCount:4},new Date("2026-08-01"),new Date("2026-09-30"));expect(x).toHaveLength(4);expect(x[1].start.getDate()).toBe(17)});
});
