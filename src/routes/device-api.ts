import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { shiftAt } from "../services/shift.js";

const statusSchema = z.object({
  firmwareVersion:z.string().max(80), localIp:z.string().max(64).optional(), wifiSsid:z.string().max(100).optional(),
  wifiRssi:z.number().int().min(-120).max(0).optional(), batteryVoltage:z.number().min(0).max(20).optional(),
  batteryPercent:z.number().int().min(0).max(100).optional(), powerSource:z.enum(["USB","BATTERY"]).optional(),
  uptimeSeconds:z.number().int().nonnegative().optional(), freeHeap:z.number().int().nonnegative().optional(),
  currentShift:z.enum(["A","B","C"]).optional(), currentScreen:z.string().max(80).optional(), backlightOn:z.boolean().optional(),
  lastEvent:z.string().max(500).nullable().optional(), lastError:z.string().max(500).nullable().optional()
});
const eventSchema = z.object({ type:z.string().max(80), severity:z.enum(["INFO","WARNING","ERROR","CRITICAL"]), message:z.string().max(1000), data:z.record(z.string(),z.unknown()).optional() });

export function deviceApi(prisma:any, config:any) {
  const router = Router();
  router.use(async (req:Request,res:Response,next:NextFunction) => {
    const id = req.get("X-Device-ID"), key = req.get("X-API-Key");
    if (!id || !key) return res.status(401).json({success:false,error:"DEVICE_AUTH_REQUIRED"});
    const device = await prisma.device.findUnique({where:{deviceId:id}});
    if (!device?.enabled || !(await bcrypt.compare(key, device.apiKeyHash))) return res.status(401).json({success:false,error:"INVALID_DEVICE_CREDENTIALS"});
    res.locals.device = device; next();
  });
  router.post("/status", async (req,res) => {
    const data = statusSchema.parse(req.body), device = res.locals.device, now = new Date();
    const updated = await prisma.device.update({where:{id:device.id},data:{...data,lastSeenAt:now}});
    const latest:any = await prisma.telemetrySample.findFirst({where:{deviceId:device.id},orderBy:{createdAt:"desc"}});
    if (!latest || now.getTime()-latest.createdAt.getTime() >= config.STATUS_HISTORY_INTERVAL_SECONDS*1000)
      await prisma.telemetrySample.create({data:{deviceId:device.id,data}});
    const [message,command,configuration,firmware] = await Promise.all([
      prisma.message.findFirst({where:{deviceId:device.id,status:"PENDING",startsAt:{lte:now},OR:[{expiresAt:null},{expiresAt:{gt:now}}]}}),
      prisma.deviceCommand.findFirst({where:{deviceId:device.id,status:"QUEUED",OR:[{expiresAt:null},{expiresAt:{gt:now}}]}}),
      prisma.deviceConfiguration.findFirst({where:{deviceId:device.id},orderBy:{version:"desc"}}),
      prisma.firmwareRelease.findFirst({where:{active:true},orderBy:{createdAt:"desc"}})
    ]);
    res.json({success:true,serverTime:now.toISOString(),messageAvailable:!!message,commandAvailable:!!command,
      configurationVersion:configuration?.version ?? 0,firmwareAvailable:!!firmware,shiftMismatch:!!data.currentShift && data.currentShift!==shiftAt(now).shift});
  });
  router.get("/messages/next", async (_req,res) => {
    const now=new Date(), device=res.locals.device;
    const message=await prisma.message.findFirst({where:{deviceId:device.id,status:"PENDING",startsAt:{lte:now},OR:[{expiresAt:null},{expiresAt:{gt:now}}]},
      orderBy:[{priority:"desc"},{createdAt:"asc"}]});
    res.json({success:true,message,pollAfterSeconds:15});
  });
  const messageActions:Record<string,{field:string,status:string}>={delivered:{field:"deliveredAt",status:"DELIVERED"},displayed:{field:"displayedAt",status:"DISPLAYED"},acknowledged:{field:"acknowledgedAt",status:"ACKNOWLEDGED"},cleared:{field:"clearedAt",status:"COMPLETED"}};
  for (const [action,meta] of Object.entries(messageActions)) router.post(`/messages/:id/${action}`,async(req,res)=>{
    const device=res.locals.device, message=await prisma.message.findFirst({where:{id:req.params.id,deviceId:device.id}});
    if(!message)return res.status(404).json({success:false,error:"MESSAGE_NOT_FOUND"});
    const delivery=await prisma.messageDelivery.upsert({where:{messageId_deviceId:{messageId:message.id,deviceId:device.id}},
      create:{messageId:message.id,deviceId:device.id,[meta.field]:new Date()},update:{}});
    if(message.status!=="CANCELLED"&&message.status!=="EXPIRED") await prisma.message.update({where:{id:message.id},data:{status:meta.status}});
    res.json({success:true,delivery});
  });
  router.get("/messages/:id/status",async(req,res)=>{
    const m=await prisma.message.findFirst({where:{id:req.params.id,deviceId:res.locals.device.id},select:{id:true,status:true,expiresAt:true}});
    res.json({success:true,message:m});
  });
  router.get("/config",async(_req,res)=>{
    const c=await prisma.deviceConfiguration.findFirst({where:{deviceId:res.locals.device.id},orderBy:{version:"desc"}});
    res.json({success:true,configuration:c});
  });
  for(const action of ["downloaded","applied","failed"])router.post(`/config/:version/${action}`,async(req,res)=>{
    const version=Number(req.params.version), field=`${action}At`, status=action.toUpperCase();
    const c=await prisma.deviceConfiguration.update({where:{deviceId_version:{deviceId:res.locals.device.id,version}},data:{status,[field]:new Date(),error:req.body?.error}});
    res.json({success:true,configuration:c});
  });
  router.get("/commands/next",async(_req,res)=>{
    const c=await prisma.deviceCommand.findFirst({where:{deviceId:res.locals.device.id,status:"QUEUED",OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},orderBy:{createdAt:"asc"}});
    res.json({success:true,command:c,pollAfterSeconds:15});
  });
  for(const action of ["downloaded","executed","failed"])router.post(`/commands/:id/${action}`,async(req,res)=>{
    const command=await prisma.deviceCommand.findFirst({where:{id:req.params.id,deviceId:res.locals.device.id}});
    if(!command)return res.status(404).json({success:false,error:"COMMAND_NOT_FOUND"});
    const field=`${action}At`, updated=await prisma.deviceCommand.update({where:{id:command.id},data:{status:action.toUpperCase(),[field]:command[field]??new Date(),error:req.body?.error}});
    res.json({success:true,command:updated});
  });
  router.post("/events",async(req,res)=>{
    const data=eventSchema.parse(req.body), event=await prisma.deviceEvent.create({data:{...data,deviceId:res.locals.device.id}});
    await prisma.device.update({where:{id:res.locals.device.id},data:{lastEvent:data.message,lastError:data.severity==="ERROR"||data.severity==="CRITICAL"?data.message:undefined}});
    res.status(201).json({success:true,eventId:event.id});
  });
  router.get("/firmware/latest",async(_req,res)=>{
    const f=await prisma.firmwareRelease.findFirst({where:{active:true},orderBy:{createdAt:"desc"}});
    res.json({success:true,firmware:f&&{...f,downloadUrl:`${config.APP_BASE_URL}/api/device/v1/firmware/${f.id}/download`}});
  });
  router.get("/firmware/:id/download",async(req,res)=>{
    const f=await prisma.firmwareRelease.findFirst({where:{id:req.params.id,active:true}});
    if(!f)return res.status(404).json({success:false,error:"FIRMWARE_NOT_FOUND"});
    res.set({"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${f.fileName}"`,"X-Firmware-SHA256":f.sha256}).send(f.binary);
  });
  return router;
}
