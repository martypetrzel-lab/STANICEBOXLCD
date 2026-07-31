# StaniceBox LCD

Česká vzdálená administrace informačního panelu Heltec WiFi LoRa 32 V4 s LCD 20×4. Obsahuje dashboard, směny C → A → B, zprávy, vzdálené příkazy, telemetrii, osoby, personální kalendář a automatická upozornění ESP32.

## První nasazení na Railway

1. U projektu StaniceBox zvolte **New → Database → PostgreSQL**.
2. V aplikační službě otevřete **Variables** a přidejte `DATABASE_URL=${{Postgres.DATABASE_URL}}` (název `Postgres` přizpůsobte názvu databázové služby).
3. Zachovejte `ADMIN_USERNAME=Hasici`, `ADMIN_PASSWORD=150150`, `DEVICE_ID=stanicebox-01` a stejný `DEVICE_API_KEY`, jaký používá firmware.
4. Doplňte proměnné z `.env.example`, zejména `SESSION_SECRET`, `APP_BASE_URL` a kalendářní intervaly.
5. Railway používá Dockerfile. Při startu se automaticky provede `npx prisma migrate deploy` a potom se spustí server.
6. Po deployi otevřete `/health`. Správná odpověď obsahuje `"status":"ok"` a `"database":"connected"`.
7. Přihlaste se jako `Hasici`, otevřete **Lidé** a založte první osobu.
8. V **Kalendáři** zvolte **Nová událost**, typ `VACATION`, osobu, směnu a termín.
9. Pro doručení na panel zaškrtněte **Upozornit ESP32**, nastavte předstih, pípnutí a případné potvrzení.

Migrace jsou verzované v `prisma/migrations`. V produkci nepoužívejte `prisma db push`.

## Proměnné prostředí

Povinné: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEVICE_ID`, `DEVICE_API_KEY`.

Kalendář:

- `CALENDAR_NOTIFICATION_LOOKAHEAD_DAYS=90`
- `CALENDAR_NOTIFICATION_CLEANUP_INTERVAL_MINUTES=15`
- `CALENDAR_DEFAULT_NOTIFY_BEFORE_MINUTES=1440`
- `APP_TIMEZONE=Europe/Prague`

Ostatní hodnoty jsou popsané v `.env.example`. Skutečný `.env` ani přístupové údaje necommitujte.

## Lokální vývoj

Vyžaduje Node.js 20+ a PostgreSQL:

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Kontroly:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm test
npm run build
```

## Kalendář

Kalendář nabízí měsíční, týdenní, denní a seznamový pohled, filtrování podle směny, osoby, typu a stavu, přesun a změnu délky události přetažením. Na mobilu se automaticky otevře seznam. Události podporují celodenní režim, více směn, priority, opakování, interní poznámku a upozornění ESP.

Při úpravě nebo smazání události se nedoručená stará upozornění zruší a potvrzená historie zůstane zachována. Opakování se generuje pouze v omezeném okně, nikoliv nekonečně.

## Test ESP endpointu

```bash
curl "https://staniceboxlcd-production.up.railway.app/api/device/v1/calendar/notifications/next" \
  -H "X-Device-ID: stanicebox-01" \
  -H "X-API-Key: VAS_DEVICE_API_KEY"
```

Kompletní API je v [docs/ESP32_API.md](docs/ESP32_API.md).

## Zálohování

V Railway otevřete PostgreSQL službu a použijte její zálohy, případně export:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=stanicebox.backup
```

Obnova: `pg_restore --clean --if-exists --dbname="$DATABASE_URL" stanicebox.backup`. Před obnovou produkce vytvořte aktuální zálohu.

## Řešení problémů migrace

- `P1001`: aplikace nedosáhne na databázi – zkontrolujte referenci `DATABASE_URL`.
- `P1000`: chybné přihlašovací údaje databáze.
- `P3009`: předchozí migrace selhala – nejprve prohlédněte Railway deploy log, neopravujte stav pomocí `db push`.
- `/health` vrací 503: databáze není dostupná nebo migrace/start ještě neskončily.

## Zachování kompatibility

Původní endpointy zpráv, příkazů, konfigurace, událostí, firmware a statusu zůstávají pod `/api/device/v1`. Kalendářní upozornění mají vlastní podcestu a nerozbíjejí současný firmware.
