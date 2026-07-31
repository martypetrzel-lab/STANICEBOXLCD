const calendarEl=document.querySelector("#calendar");
const csrfCalendar=calendarEl?.dataset.csrf;
const filters=["shift","person","type","status"];
function eventUrl(info){const q=new URLSearchParams();for(const f of filters){const v=document.querySelector(`#filter-${f}`)?.value;if(v)q.set(f==="person"?"personId":f,v)}q.set("start",info.startStr);q.set("end",info.endStr);return `/api/calendar/events?${q}`}
if(calendarEl&&window.FullCalendar){
  const calendar=new FullCalendar.Calendar(calendarEl,{locale:"cs",timeZone:"Europe/Prague",initialView:innerWidth<700?"listMonth":"dayGridMonth",height:"auto",editable:true,selectable:true,
    headerToolbar:{left:"prev,next today",center:"title",right:"dayGridMonth,timeGridWeek,timeGridDay,listMonth"},buttonText:{today:"Dnes",month:"Měsíc",week:"Týden",day:"Den",list:"Seznam"},
    events:(info,success,failure)=>fetch(eventUrl(info)).then(r=>r.json()).then(success).catch(failure),
    dateClick:info=>location.href=`/calendar/events/new?date=${info.dateStr}`,
    eventClick:info=>location.href=`/calendar/events/${info.event.id}/edit`,eventDrop:update,eventResize:update});
  async function update(info){const r=await fetch(`/api/calendar/events/${info.event.id}`,{method:"PUT",headers:{"content-type":"application/json","x-csrf-token":csrfCalendar},body:JSON.stringify({startAt:info.event.start.toISOString(),endAt:(info.event.end??info.event.start).toISOString()})});if(!r.ok){info.revert();alert("Událost se nepodařilo přesunout.")}}
  calendar.render();filters.forEach(f=>document.querySelector(`#filter-${f}`)?.addEventListener("change",()=>calendar.refetchEvents()));
  document.querySelector("#clear-calendar")?.addEventListener("click",async()=>{
    if(!confirm("Opravdu vymazat všechny události z kalendáře? Tuto akci nelze vrátit zpět."))return;
    const r=await fetch("/api/calendar/events",{method:"DELETE",headers:{"x-csrf-token":csrfCalendar}});
    if(r.ok){calendar.refetchEvents();alert("Kalendář byl vymazán.");}else alert("Kalendář se nepodařilo vymazat.");
  });
}
