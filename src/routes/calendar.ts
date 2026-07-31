import { Router } from "express";
import { z } from "zod";
import { csrf } from "../middleware/auth.js";
import { absenceTypes, rebuildNotifications, recurrenceDates } from "../services/calendar.js";

const personSchema=z.object({firstName:z.string().min(1).max(80),lastName:z.string().min(1).max(80),displayName:z.string().min(1).max(120),shift:z.enum(["A","B","C"]),email:z.string().email().optional().or(z.literal("")),phone:z.string().max(40).optional(),color:z.string().regex(/^#[0-9a-f]{6}$/i),note:z.string().max(2000).optional(),active:z.boolean().optional()});
const eventSchema=z.object({title:z.string().min(1).max(160),description:z.string().max(5000).optional().nullable(),internalNote:z.string().max(5000).optional().nullable(),eventType:z.enum(["VACATION","SICKNESS","TRAINING","SHIFT_CHANGE","MEETING","TECHNICAL_CHECK","SERVICE","INSPECTION","NOTE","OTHER"]),
  startAt:z.coerce.date(),endAt:z.coerce.date(),allDay:z.boolean().default(false),priority:z.enum(["LOW","NORMAL","IMPORTANT","CRITICAL"]).default("NORMAL"),status:z.enum(["ACTIVE","CANCELLED","COMPLETED"]).default("ACTIVE"),color:z.string().regex(/^#[0-9a-f]{6}$/i),
  personId:z.string().uuid().optional().nullable(),shifts:z.array(z.enum(["A","B","C","ALL"])).min(1),notifyEsp:z.boolean().default(false),notifyBeforeMinutes:z.number().int().nonnegative().default(1440),notifyOnStartDay:z.boolean().default(false),
  requireAcknowledgement:z.boolean().default(false),beepEnabled:z.boolean().default(false),durationSeconds:z.number().int().min(5).max(3600).default(20),recurrenceType:z.enum(["NONE","DAILY","WEEKLY","MONTHLY","YEARLY"]).default("NONE"),recurrenceInterval:z.number().int().positive().default(1),recurrenceUntil:z.coerce.date().optional().nullable(),recurrenceCount:z.number().int().positive().optional().nullable()}).refine(x=>x.endAt>=x.startAt,{message:"Konec musí být po začátku."});

export function calendarRoutes(prisma:any,config:any){
  const router=Router();
  async function audit(req:any,action:string,eventId?:string,details?:any){await prisma.eventAuditLog.create({data:{eventId,userId:req.session.userId,action,details:details?JSON.parse(JSON.stringify(details)):undefined}});}
  router.get("/calendar",async(req,res)=>res.render("calendar",{people:await prisma.person.findMany({where:{active:true},orderBy:{displayName:"asc"}})}));
  router.get("/calendar/events/new",async(req,res)=>res.render("calendar-event-form",{event:null,people:await prisma.person.findMany({where:{active:true},orderBy:{displayName:"asc"}})}));
  router.get("/calendar/events/:id/edit",async(req,res)=>res.render("calendar-event-form",{event:await prisma.calendarEvent.findUniqueOrThrow({where:{id:req.params.id},include:{shifts:true}}),people:await prisma.person.findMany({where:{active:true},orderBy:{displayName:"asc"}})}));
  router.get("/people",async(_req,res)=>res.render("people",{people:await prisma.person.findMany({orderBy:[{active:"desc"},{displayName:"asc"}]})}));
  router.get("/notifications",async(req,res)=>{const where:any={};if(req.query.status)where.status=String(req.query.status);if(req.query.type)where.event={eventType:String(req.query.type)};res.render("notifications",{notifications:await prisma.eventNotification.findMany({where,include:{event:{include:{person:true,shifts:true}}},orderBy:{scheduledAt:"desc"},take:200}),filter:req.query})});

  router.get("/api/people",async(_req,res)=>res.json(await prisma.person.findMany({orderBy:{displayName:"asc"}})));
  router.get("/api/people/:id",async(req,res)=>res.json(await prisma.person.findUnique({where:{id:req.params.id}})));
  router.post("/api/people",csrf,async(req,res)=>{const data=personSchema.parse(req.body);const p=await prisma.person.create({data});await prisma.auditLog.create({data:{userId:req.session.userId,action:"PERSON_CREATED",entityType:"Person",entityId:p.id}});res.status(201).json(p);});
  router.put("/api/people/:id",csrf,async(req,res)=>{const data=personSchema.partial().parse(req.body);const p=await prisma.person.update({where:{id:req.params.id},data});await prisma.auditLog.create({data:{userId:req.session.userId,action:"PERSON_UPDATED",entityType:"Person",entityId:p.id}});res.json(p);});
  router.delete("/api/people/:id",csrf,async(req,res)=>{const count=await prisma.calendarEvent.count({where:{personId:req.params.id}});if(count){await prisma.person.update({where:{id:req.params.id},data:{active:false}});}else await prisma.person.delete({where:{id:req.params.id}});await prisma.auditLog.create({data:{userId:req.session.userId,action:count?"PERSON_DEACTIVATED":"PERSON_DELETED",entityType:"Person",entityId:String(req.params.id)}});res.json({success:true,deactivated:count>0});});

  router.get("/api/calendar/events",async(req,res)=>{const from=new Date(String(req.query.start??new Date(Date.now()-86400000).toISOString())),to=new Date(String(req.query.end??new Date(Date.now()+90*86400000).toISOString()));const where:any={deletedAt:null};
    if(req.query.personId)where.personId=String(req.query.personId);if(req.query.type)where.eventType=String(req.query.type);if(req.query.status)where.status=String(req.query.status);
    if(req.query.shift)where.shifts={some:{shift:{in:[String(req.query.shift),"ALL"]}}};
    const events=await prisma.calendarEvent.findMany({where,include:{person:true,shifts:true}});
    res.json(events.flatMap((event:any)=>recurrenceDates(event,from,to).map((occurrence,i)=>({id:event.id,title:event.title,start:occurrence.start,end:occurrence.end,allDay:event.allDay,color:event.color,extendedProps:{...event,occurrence:i}}))));});
  router.get("/api/calendar/events/:id",async(req,res)=>res.json(await prisma.calendarEvent.findUnique({where:{id:req.params.id},include:{person:true,shifts:true}})));
  router.post("/api/calendar/events",csrf,async(req,res)=>{const input=eventSchema.parse(req.body),{shifts,...data}=input,device=await prisma.device.findUniqueOrThrow({where:{deviceId:config.DEVICE_ID}});
    const event=await prisma.calendarEvent.create({data:{...data,shifts:{create:shifts.map(shift=>({shift}))}},include:{shifts:true}});await rebuildNotifications(prisma,event.id,device.id);await audit(req,"CREATED",event.id,{title:event.title});res.status(201).json(event);});
  router.put("/api/calendar/events/:id",csrf,async(req,res)=>{const input=eventSchema.partial().parse(req.body),shifts=input.shifts,{shifts:_s,...data}=input,device=await prisma.device.findUniqueOrThrow({where:{deviceId:config.DEVICE_ID}});
    const event=await prisma.$transaction(async(tx:any)=>{if(shifts){await tx.calendarEventShift.deleteMany({where:{eventId:req.params.id}});}return tx.calendarEvent.update({where:{id:req.params.id},data:{...data,...(shifts?{shifts:{create:shifts.map(shift=>({shift}))}}:{})},include:{shifts:true}});});
    await rebuildNotifications(prisma,event.id,device.id);await audit(req,"UPDATED",event.id,data);res.json(event);});
  router.delete("/api/calendar/events",csrf,async(req,res)=>{const now=new Date();const result=await prisma.$transaction(async(tx:any)=>{
    const events=await tx.calendarEvent.findMany({where:{deletedAt:null},select:{id:true}});
    if(!events.length)return {count:0};
    const eventIds=events.map((event:any)=>event.id);
    await tx.eventNotification.updateMany({where:{eventId:{in:eventIds},status:{in:["WAITING","AVAILABLE"]}},data:{status:"CANCELLED",cancelledAt:now}});
    const deleted=await tx.calendarEvent.updateMany({where:{id:{in:eventIds}},data:{deletedAt:now,status:"CANCELLED"}});
    await tx.eventAuditLog.create({data:{userId:req.session.userId,action:"CALENDAR_CLEARED",details:{count:deleted.count}}});
    return {count:deleted.count};
  });res.json({success:true,deleted:result.count});});
  router.delete("/api/calendar/events/:id",csrf,async(req,res)=>{await prisma.calendarEvent.update({where:{id:req.params.id},data:{deletedAt:new Date(),status:"CANCELLED"}});await prisma.eventNotification.updateMany({where:{eventId:req.params.id,status:{in:["WAITING","AVAILABLE"]}},data:{status:"CANCELLED",cancelledAt:new Date()}});await audit(req,"DELETED",String(req.params.id));res.json({success:true});});
  router.post("/api/calendar/notifications/:id/repeat",csrf,async(req,res)=>{const old=await prisma.eventNotification.findUniqueOrThrow({where:{id:req.params.id}});const {id,createdAt,updatedAt,cancelledAt,...copy}=old;const notification=await prisma.eventNotification.create({data:{...copy,status:"AVAILABLE",scheduledAt:new Date()}});await audit(req,"NOTIFICATION_REPEATED",old.eventId,{notificationId:notification.id});res.status(201).json(notification);});
  router.get("/api/calendar/upcoming",async(_req,res)=>res.json(await prisma.calendarEvent.findMany({where:{deletedAt:null,status:"ACTIVE",startAt:{gte:new Date(),lte:new Date(Date.now()+7*86400000)}},include:{person:true,shifts:true},orderBy:{startAt:"asc"}})));
  router.get("/api/calendar/today",async(_req,res)=>{const start=new Date();start.setHours(0,0,0,0);const end=new Date(start.getTime()+86400000);res.json(await prisma.calendarEvent.findMany({where:{deletedAt:null,status:"ACTIVE",startAt:{lt:end},endAt:{gte:start}},include:{person:true,shifts:true}}));});
  router.get("/api/calendar/absences",async(_req,res)=>res.json(await prisma.calendarEvent.findMany({where:{deletedAt:null,status:"ACTIVE",eventType:{in:absenceTypes},startAt:{lte:new Date()},endAt:{gte:new Date()}},include:{person:true,shifts:true}})));
  return router;
}
