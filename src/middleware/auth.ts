import type { NextFunction, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";

export function requireAdmin(req:Request, res:Response, next:NextFunction) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}
export function csrfToken(req:Request) {
  return req.session.csrf ??= randomBytes(24).toString("hex");
}
export function csrf(req:Request, res:Response, next:NextFunction) {
  if (["GET","HEAD","OPTIONS"].includes(req.method)) return next();
  const expected = Buffer.from(req.session.csrf ?? "");
  const actual = Buffer.from(String(req.body?._csrf ?? req.get("x-csrf-token") ?? ""));
  if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return res.status(403).send("Neplatný bezpečnostní token.");
  next();
}
