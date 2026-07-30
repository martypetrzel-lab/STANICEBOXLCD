type Weather = { temperature:number; apparentTemperature:number; windSpeed:number; description:string; updatedAt:string; stale:boolean };
let cache: Weather | null = null;
let cachedAt = 0;
const descriptions: Record<number,string> = {0:"Jasno",1:"Převážně jasno",2:"Polojasno",3:"Zataženo",45:"Mlha",51:"Mrholení",61:"Déšť",71:"Sněžení",80:"Přeháňky",95:"Bouřka"};
export async function getWeather(lat:number, lon:number, ttlMinutes:number): Promise<Weather | null> {
  if (cache && Date.now() - cachedAt < ttlMinutes * 60_000) return cache;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FPrague`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("weather");
    const c = (await response.json() as any).current;
    cache = { temperature:c.temperature_2m, apparentTemperature:c.apparent_temperature, windSpeed:c.wind_speed_10m,
      description:descriptions[c.weather_code] ?? "Proměnlivo", updatedAt:new Date().toISOString(), stale:false };
    cachedAt = Date.now(); return cache;
  } catch {
    return cache ? { ...cache, stale:true } : null;
  }
}
