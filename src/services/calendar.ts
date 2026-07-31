import { removeDiacritics } from "./lcd.js";

export const absenceTypes = ["VACATION","SICKNESS","TRAINING"];
export const eventTypeLabels:Record<string,string>={VACATION:"Dovolená",SICKNESS:"Nemoc",TRAINING:"Školení",SHIFT_CHANGE:"Výměna směny",MEETING:"Porada",TECHNICAL_CHECK:"Kontrola techniky",SERVICE:"Servis",INSPECTION:"Revize",NOTE:"Poznámka",OTHER:"Jiná událost"};

export function lcdEventLines(event:any){
  const person=event.person?.displayName??"Vsechny smeny";
  const shifts=(event.shifts??[]).map((s:any)=>s.shift).join(", ")||"ALL";
  const fmt=(d:Date)=>new Intl.DateTimeFormat("cs-CZ",{timeZone:"Europe/Prague",day:"numeric",month:"numeric"}).format(d);
  const crop=(s:string)=>removeDiacritics(s).slice(0,20);
  return [
    crop(eventTypeLabels[event.eventType]??event.title).toUpperCase(),
    crop(person),
    crop(`${fmt(event.startAt)} - ${fmt(event.endAt)}`),
    crop(shifts==="ALL"?"Vsechny smeny":`Smena ${shifts}`)
  ];
}

export function recurrenceDates(event:any, from:Date, to:Date){
  const results:{start:Date;end:Date}[]=[];
  let start=new Date(event.startAt),end=new Date(event.endAt),count=0;
  while(start<=to && count<500){
    if(end>=from)results.push({start:new Date(start),end:new Date(end)});
    count++;
    if(event.recurrenceType==="NONE"||(event.recurrenceCount&&count>=event.recurrenceCount)||(event.recurrenceUntil&&start>=event.recurrenceUntil))break;
    const step=Math.max(1,event.recurrenceInterval??1);
    if(event.recurrenceType==="DAILY"){start.setDate(start.getDate()+step);end.setDate(end.getDate()+step);}
    if(event.recurrenceType==="WEEKLY"){start.setDate(start.getDate()+7*step);end.setDate(end.getDate()+7*step);}
    if(event.recurrenceType==="MONTHLY"){start.setMonth(start.getMonth()+step);end.setMonth(end.getMonth()+step);}
    if(event.recurrenceType==="YEARLY"){start.setFullYear(start.getFullYear()+step);end.setFullYear(end.getFullYear()+step);}
  }
  return results;
}

export async function rebuildNotifications(prisma:any,eventId:string,deviceId:string){
  await prisma.eventNotification.updateMany({where:{eventId,status:{in:["WAITING","AVAILABLE"]}},data:{status:"CANCELLED",cancelledAt:new Date()}});
  const event=await prisma.calendarEvent.findUnique({where:{id:eventId},include:{person:true,shifts:true}});
  if(!event?.notifyEsp||event.status!=="ACTIVE"||event.deletedAt)return;
  const now=new Date(),occurrences=recurrenceDates(event,new Date(now.getTime()-86400000),new Date(now.getTime()+90*86400000));
  for(const occurrence of occurrences){
    const occurrenceEvent={...event,startAt:occurrence.start,endAt:occurrence.end},lines=lcdEventLines(occurrenceEvent),schedules:{type:string;at:Date}[]=[];
    if(event.notifyBeforeMinutes>0)schedules.push({type:"BEFORE",at:new Date(occurrence.start.getTime()-event.notifyBeforeMinutes*60000)});
    if(event.notifyOnStartDay){const at=new Date(occurrence.start);at.setHours(6,0,0,0);schedules.push({type:"START_DAY",at});}
    for(const schedule of schedules)await prisma.eventNotification.create({data:{eventId,deviceId,notificationType:schedule.type,scheduledAt:schedule.at,
      expiresAt:new Date(occurrence.end.getTime()+86400000),status:schedule.at<=now?"AVAILABLE":"WAITING",title:event.title,
      body:`${event.person?.displayName??""} ${event.title}`.trim(),lcdLine1:lines[0],lcdLine2:lines[1],lcdLine3:lines[2],lcdLine4:lines[3]}});
  }
}
