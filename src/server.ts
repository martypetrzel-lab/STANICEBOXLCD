import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config=loadConfig(), prisma=new PrismaClient();
async function bootstrap(){
  const passwordHash=await bcrypt.hash(config.ADMIN_PASSWORD,12), apiKeyHash=await bcrypt.hash(config.DEVICE_API_KEY,12);
  await prisma.user.upsert({where:{email:config.ADMIN_EMAIL.toLowerCase()},update:{},create:{email:config.ADMIN_EMAIL.toLowerCase(),passwordHash}});
  await prisma.device.upsert({where:{deviceId:config.DEVICE_ID},update:{},create:{deviceId:config.DEVICE_ID,name:"StaniceBox LCD",apiKeyHash}});
  const app=createApp({prisma,config});
  app.listen(config.PORT,"0.0.0.0",()=>console.log(`StaniceBox naslouchá na portu ${config.PORT}`));
}
bootstrap().catch(async e=>{console.error("Aplikaci se nepodařilo spustit:",e.message);await prisma.$disconnect();process.exit(1);});
process.on("SIGTERM",async()=>{await prisma.$disconnect();process.exit(0);});
