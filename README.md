# StaniceBox LCD

Vzdálená česká administrace panelu Heltec WiFi LoRa 32 V4 s LCD 20×4. Aplikace nabízí tmavý mobilní dashboard, směny C → A → B, počasí Open‑Meteo, zprávy s LCD náhledem, verzované nastavení, vzdálené příkazy, události, telemetrii a bezpečně připravené OTA soubory. ESP32 navazuje pouze odchozí HTTPS spojení, takže funguje i za NAT.

## První nasazení na Railway

1. V Railway zvolte **New Project → Deploy from GitHub repo** a vyberte `martypetrzel-lab/STANICEBOXLCD`.
2. Přidejte službu **PostgreSQL**. Railway vloží `DATABASE_URL`; pokud ne, připojte referenci `${{Postgres.DATABASE_URL}}`.
3. V aplikaci nastavte všechny proměnné z `.env.example`. `SESSION_SECRET`, `ADMIN_PASSWORD` a `DEVICE_API_KEY` použijte dlouhé náhodné hodnoty (alespoň 16 znaků; heslo alespoň 10).
4. Povinné jsou `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEVICE_ID`, `DEVICE_API_KEY`. Dále nastavte `APP_BASE_URL` na výslednou veřejnou HTTPS adresu. Souřadnice Mstětic jsou předvyplněné.
5. V **Settings → Networking → Generate Domain** vytvořte veřejnou doménu.
6. Deployment automaticky spustí Prisma migrace. Ověřte `https://DOMENA/health`; odpověď musí uvádět `status: ok` a `database: connected`.
7. Otevřete doménu a přihlaste se přes `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
8. Do stávajícího ESP32 firmware doplňte základní URL a autentizační hlavičky dle [docs/ESP32_API.md](docs/ESP32_API.md). První `POST /status` zobrazí panel jako online.
9. V **Zprávy → Nová zpráva** vytvořte zprávu; ESP32 ji získá z `GET /messages/next`.
10. Po zobrazení musí firmware zavolat `delivered`, `displayed` a případně `acknowledged`. Stav se projeví v historii.

## Lokální vývoj

Vyžaduje Node.js 20+ a PostgreSQL. Zkopírujte `.env.example` do `.env`, doplňte tajemství, nainstalujte balíčky, aplikujte migrace a spusťte vývojový server:

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Kontroly: `npx prisma validate`, `npm run typecheck`, `npm test`, `npm run build`.

## Proměnné prostředí

`NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEVICE_ID`, `DEVICE_API_KEY`, `DEVICE_OFFLINE_SECONDS`, `APP_TIMEZONE`, `LOCATION_NAME`, `LOCATION_LATITUDE`, `LOCATION_LONGITUDE`, `WEATHER_CACHE_MINUTES`, `STATUS_HISTORY_INTERVAL_SECONDS`, `APP_BASE_URL`.

Skutečný `.env` se necommituje. Hesla a API klíče jsou uloženy jako bcrypt hash, cookies jsou HttpOnly/SameSite a v produkci Secure. Formuláře mají CSRF ochranu, vstupy jsou omezené a validované.

## Struktura

- `src/app.ts` – web, přihlášení a administrační routy
- `src/routes/device-api.ts` – kompletní pull API ESP32
- `src/services` – směny, počasí, jmeniny a LCD převod
- `src/views`, `src/public` – EJS rozhraní, responzivní CSS a JavaScript
- `prisma/schema.prisma` – PostgreSQL modely a indexy
- `docs/ESP32_API.md` – integrační smlouva pro firmware
- `tests` – automatické testy výpočtů a bezpečné konfigurace

## Co doplnit do ESP32

Heartbeat `POST /status`; polling `/messages/next`, `/commands/next` a `/config`; potvrzení stavů zprávy, příkazu a konfigurace; odesílání `/events`; kontrolu `/firmware/latest`; pětisekundový timeout, exponential backoff, neblokující síťovou úlohu a ukládání posledních ID do Preferences. Běžný lokální web, čas, směny, tlačítka a LCD cyklus zůstávají nezávislé na Railway.
