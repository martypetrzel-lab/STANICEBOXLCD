import bcrypt from "bcrypt";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createMemoryStore } from "./store.js";

const config=loadConfig();
async function bootstrap(){
  const prisma=createMemoryStore({
    username:config.ADMIN_USERNAME,
    passwordHash:await bcrypt.hash(config.ADMIN_PASSWORD,12),
    deviceId:config.DEVICE_ID,
    apiKeyHash:await bcrypt.hash(config.DEVICE_API_KEY,12)
  });
  const app=createApp({prisma,config});
  app.listen(config.PORT,"0.0.0.0",()=>console.log(`StaniceBox naslouchá na portu ${config.PORT}`));
}
bootstrap().catch(e=>{console.error("Aplikaci se nepodařilo spustit:",e.message);process.exit(1);});
