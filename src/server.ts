import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config=loadConfig();
const prisma=new PrismaClient();
async function bootstrap(){
  await prisma.user.upsert({where:{username:config.ADMIN_USERNAME},update:{},create:{username:config.ADMIN_USERNAME,passwordHash:await bcrypt.hash(config.ADMIN_PASSWORD,12)}});
  await prisma.device.upsert({where:{deviceId:config.DEVICE_ID},update:{},create:{deviceId:config.DEVICE_ID,name:"StaniceBox LCD",apiKeyHash:await bcrypt.hash(config.DEVICE_API_KEY,12)}});
  const app=createApp({prisma,config});
  setInterval(async()=>{const now=new Date();await prisma.eventNotification.updateMany({where:{status:{in:["WAITING","AVAILABLE"]},expiresAt:{lte:now}},data:{status:"EXPIRED"}});await prisma.eventNotification.updateMany({where:{status:"WAITING",scheduledAt:{lte:now}},data:{status:"AVAILABLE"}});},config.CALENDAR_NOTIFICATION_CLEANUP_INTERVAL_MINUTES*60000).unref();
  app.listen(config.PORT,"0.0.0.0",()=>console.log(`StaniceBox naslouchá na portu ${config.PORT}`));
}
bootstrap().catch(async e=>{console.error("Aplikaci se nepodařilo spustit:",e.message);await prisma.$disconnect();process.exit(1);});
process.on("SIGTERM",async()=>{await prisma.$disconnect();process.exit(0);});
