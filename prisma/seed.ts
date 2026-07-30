import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { loadConfig } from "../src/config.js";
const prisma=new PrismaClient(),config=loadConfig();
await prisma.user.upsert({where:{email:config.ADMIN_EMAIL.toLowerCase()},update:{},create:{email:config.ADMIN_EMAIL.toLowerCase(),passwordHash:await bcrypt.hash(config.ADMIN_PASSWORD,12)}});
await prisma.device.upsert({where:{deviceId:config.DEVICE_ID},update:{},create:{deviceId:config.DEVICE_ID,name:"StaniceBox LCD",apiKeyHash:await bcrypt.hash(config.DEVICE_API_KEY,12)}});
await prisma.$disconnect();
