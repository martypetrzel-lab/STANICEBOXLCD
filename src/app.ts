import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt";
import { z, ZodError } from "zod";
import path from "node:path";
import multer from "multer";
import { createHash } from "node:crypto";
import { shiftAt, yearStatistics } from "./services/shift.js";
import { nameday } from "./services/namedays.js";
import { getWeather } from "./services/weather.js";
import { removeDiacritics, wrapLcd } from "./services/lcd.js";
import { csrf, csrfToken, requireAdmin } from "./middleware/auth.js";
import { deviceApi } from "./routes/device-api.js";

const messageSchema=z.object({title:z.string().min(1).max(100),body:z.string().min(1).max(4000),priority:z.enum(["NORMAL","IMPORTANT","CRITICAL"]),
  displayMode:z.enum(["ROTATION","IMMEDIATE","STICKY","FULLSCREEN"]),durationSeconds:z.coerce.number().int().min(5).max(3600),
  startsAt:z.string().optional(),expiresAt:z.string().optional(),beepEnabled:z.string().optional(),requireAcknowledgement:z.string().optional()});
const commandTypes=["SHOW_INFO","NEXT_PAGE","BACKLIGHT_ON","BACKLIGHT_OFF","RECONNECT_WIFI","RESTART_DEVICE","CLEAR_MESSAGE","REFRESH_WEATHER","REFRESH_NAMEDAY"];
const defaultSettings={pageIntervalSeconds:10,backlightEnabled:true,dayBrightness:100,nightBrightness:25,nightStart:"22:00",nightEnd:"06:00",
  buzzerEnabled:true,pollIntervalSeconds:15,lowBatteryPercent:20,criticalBatteryPercent:10,pages:["time","shift","weather","nameday","battery","network","diagnostics"]};

export function createApp({prisma,config}:{prisma:any;config:any}) {
  const app=express(), PgStore=pgSession(session);
  const firmwareUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:16*1024*1024},fileFilter:(_req,file,cb)=>cb(null,file.originalname.toLowerCase().endsWith(".bin"))});
  app.set("view engine","ejs"); app.set("views",path.resolve("src/views")); app.set("trust proxy",1);
  app.use(helmet({contentSecurityPolicy:{directives:{"script-src":["'self'"],"style-src":["'self'"]}}}));
  app.use(express.urlencoded({extended:false,limit:"100kb"})); app.use(express.json({limit:"100kb"}));
  app.use(express.static(path.resolve("src/public")));
  app.use(session({store:new PgStore({conString:config.DATABASE_URL,createTableIfMissing:true,tableName:"Session"}),secret:config.SESSION_SECRET,resave:false,saveUninitialized:false,
    cookie:{httpOnly:true,secure:config.NODE_ENV==="production",sameSite:"lax",maxAge:8*60*60*1000}}));
  app.locals.fmt=(d:Date|null)=>d?new Intl.DateTimeFormat("cs-CZ",{dateStyle:"short",timeStyle:"medium",timeZone:config.APP_TIMEZONE}).format(d):"—";
  app.use("/api/device/v1",rateLimit({windowMs:60_000,limit:180,standardHeaders:"draft-8",legacyHeaders:false}),deviceApi(prisma,config));
  app.get("/health",async(_req,res)=>{try{await prisma.$queryRaw`SELECT 1`;res.json({status:"ok",database:"connected",version:"1.0.0",time:new Date().toISOString()});}
    catch{res.status(503).json({status:"error",database:"disconnected",version:"1.0.0",time:new Date().toISOString()});}});
  app.get("/login",(req,res)=>res.render("login",{error:null,csrf:csrfToken(req)}));
  app.post("/login",rateLimit({windowMs:15*60_000,limit:10}),csrf,async(req,res)=>{
    const user=await prisma.user.findUnique({where:{email:String(req.body.email).toLowerCase()}});
    if(!user||!(await bcrypt.compare(String(req.body.password),user.passwordHash)))return res.status(401).render("login",{error:"Neplatný e-mail nebo heslo.",csrf:csrfToken(req)});
    req.session.regenerate(()=>{req.session.userId=user.id;req.session.csrf=undefined;res.redirect("/");});
  });
  app.post("/logout",requireAdmin,csrf,(req,res)=>req.session.destroy(()=>res.redirect("/login")));
  app.use(requireAdmin);
  app.use((req,res,next)=>{res.locals.csrf=csrfToken(req);res.locals.path=req.path;next();});
  async function device(){return prisma.device.findUnique({where:{deviceId:config.DEVICE_ID}});}
  app.get("/",async(_req,res)=>{
    const d=await device(), now=new Date(), shift=shiftAt(now), weather=await getWeather(config.LOCATION_LATITUDE,config.LOCATION_LONGITUDE,config.WEATHER_CACHE_MINUTES);
    const online=!!d?.lastSeenAt&&now.getTime()-d.lastSeenAt.getTime()<config.DEVICE_OFFLINE_SECONDS*1000;
    const [lastMessage,lastEvent]=d?await Promise.all([prisma.message.findFirst({where:{deviceId:d.id},orderBy:{updatedAt:"desc"}}),prisma.deviceEvent.findFirst({where:{deviceId:d.id},orderBy:{createdAt:"desc"}})]):[null,null];
    res.render("dashboard",{device:d,online,shift,weather,nameday:nameday(now),location:config.LOCATION_NAME,lastMessage,lastEvent});
  });
  app.get("/api/admin/dashboard",async(_req,res)=>{
    const d=await device(), now=new Date(); res.json({time:now.toISOString(),shift:shiftAt(now),device:d,online:!!d?.lastSeenAt&&now.getTime()-d.lastSeenAt.getTime()<config.DEVICE_OFFLINE_SECONDS*1000});
  });
  app.get("/statistics",(_req,res)=>{const now=new Date(),stats=yearStatistics(+new Intl.DateTimeFormat("en",{year:"numeric",timeZone:config.APP_TIMEZONE}).format(now),now);res.render("statistics",{stats,upcoming:stats.days.filter(x=>x.date>=now.toISOString().slice(0,10)).slice(0,30)});});
  app.get("/messages",async(req,res)=>{const d=await device(),where:any={deviceId:d?.id};if(req.query.status)where.status=req.query.status;if(req.query.priority)where.priority=req.query.priority;
    res.render("messages",{messages:d?await prisma.message.findMany({where,orderBy:{createdAt:"desc"},take:100}):[],filter:req.query});});
  app.get("/messages/new",(_req,res)=>res.render("message-form",{message:null}));
  app.post("/messages",csrf,async(req,res)=>{const data=messageSchema.parse(req.body),d=await device();if(!d)return res.status(409).send("Zařízení neexistuje.");
    const lcdTitle=removeDiacritics(data.title),lcdBody=removeDiacritics(data.body),preview=wrapLcd(`${lcdTitle}\n${lcdBody}`);
    await prisma.message.create({data:{deviceId:d.id,...data,lcdTitle,lcdBody,lcdLines:preview.lines,startsAt:data.startsAt?new Date(data.startsAt):new Date(),
      expiresAt:data.expiresAt?new Date(data.expiresAt):null,beepEnabled:!!data.beepEnabled,requireAcknowledgement:!!data.requireAcknowledgement}});
    res.redirect("/messages");});
  app.post("/messages/:id/cancel",csrf,async(req,res)=>{await prisma.message.update({where:{id:req.params.id},data:{status:"CANCELLED"}});res.redirect("/messages");});
  app.post("/messages/:id/delete",csrf,async(req,res)=>{await prisma.message.delete({where:{id:req.params.id}});res.redirect("/messages");});
  app.post("/messages/:id/repeat",csrf,async(req,res)=>{const old=await prisma.message.findUniqueOrThrow({where:{id:req.params.id}});const {id,createdAt,updatedAt,status,...copy}=old;await prisma.message.create({data:{...copy,status:"PENDING",startsAt:new Date()}});res.redirect("/messages");});
  app.get("/settings",async(_req,res)=>{const d=await device(),latest=d?await prisma.deviceConfiguration.findFirst({where:{deviceId:d.id},orderBy:{version:"desc"}}):null;res.render("settings",{configuration:latest,settings:latest?.settings??defaultSettings});});
  app.post("/settings",csrf,async(req,res)=>{const d=await device();if(!d)return res.status(409).send("Zařízení neexistuje.");const latest=await prisma.deviceConfiguration.findFirst({where:{deviceId:d.id},orderBy:{version:"desc"}});
    const settings={...defaultSettings,...req.body,pageIntervalSeconds:Number(req.body.pageIntervalSeconds),dayBrightness:Number(req.body.dayBrightness),nightBrightness:Number(req.body.nightBrightness),pollIntervalSeconds:Number(req.body.pollIntervalSeconds)};
    await prisma.deviceConfiguration.create({data:{deviceId:d.id,version:(latest?.version??0)+1,settings}});res.redirect("/settings");});
  app.get("/device",async(_req,res)=>{const d=await device();const commands=d?await prisma.deviceCommand.findMany({where:{deviceId:d.id},orderBy:{createdAt:"desc"},take:30}):[];res.render("device",{device:d,commands,commandTypes});});
  app.post("/device/commands",csrf,async(req,res)=>{if(!commandTypes.includes(req.body.type))return res.status(400).send("Neplatný příkaz.");const d=await device();await prisma.deviceCommand.create({data:{deviceId:d.id,type:req.body.type,expiresAt:new Date(Date.now()+3600_000)}});res.redirect("/device");});
  app.post("/device/commands/:id/cancel",csrf,async(req,res)=>{await prisma.deviceCommand.update({where:{id:req.params.id},data:{status:"CANCELLED"}});res.redirect("/device");});
  app.get("/events",async(_req,res)=>{const d=await device();res.render("events",{events:d?await prisma.deviceEvent.findMany({where:{deviceId:d.id},orderBy:{createdAt:"desc"},take:200}):[]});});
  app.get("/firmware",async(_req,res)=>res.render("firmware",{releases:await prisma.firmwareRelease.findMany({orderBy:{createdAt:"desc"}})}));
  app.post("/firmware",firmwareUpload.single("binary"),csrf,async(req,res)=>{
    if(!req.file)return res.status(400).send("Vyberte platný .bin soubor.");
    const sha256=createHash("sha256").update(req.file.buffer).digest("hex");
    const release=await prisma.firmwareRelease.create({data:{version:String(req.body.version),notes:String(req.body.notes??""),fileName:req.file.originalname,fileUrl:"database",binary:req.file.buffer,sha256,active:false}});
    res.redirect("/firmware");
  });
  app.post("/firmware/:id/activate",csrf,async(req,res)=>{await prisma.$transaction([prisma.firmwareRelease.updateMany({data:{active:false}}),prisma.firmwareRelease.update({where:{id:req.params.id},data:{active:true}})]);res.redirect("/firmware");});
  app.use((err:any,_req:any,res:any,_next:any)=>{console.error(err instanceof ZodError?"Validation error":err?.message);res.status(err instanceof ZodError?400:500).render("error",{message:err instanceof ZodError?"Zkontrolujte zadané údaje.":"Nastala neočekávaná chyba."});});
  return app;
}
