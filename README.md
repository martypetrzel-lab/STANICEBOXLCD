# StaniceBox LCD

Vzdálená česká administrace panelu Heltec WiFi LoRa 32 V4 s LCD 20×4. Aplikace nevyžaduje databázi; provozní data drží pouze v paměti a po restartu služby se vymažou.

## První nasazení na Railway

1. V Railway zvolte **New Project → Deploy from GitHub repo** a vyberte `martypetrzel-lab/STANICEBOXLCD`.
2. Nepřidávejte PostgreSQL ani jinou databázi.
3. Proměnné jsou volitelné; výchozí přihlášení je jméno `Hasici` a heslo `150150`.
4. Pro ESP32 doporučujeme nastavit vlastní `DEVICE_API_KEY`. Dále nastavte `APP_BASE_URL` na výslednou veřejnou HTTPS adresu.
5. V **Settings → Networking → Generate Domain** vytvořte veřejnou doménu.
6. Ověřte `https://DOMENA/health`; odpověď musí uvádět `status: ok` a `storage: memory`.
7. Otevřete doménu a přihlaste se jako `Hasici` s heslem `150150`.
8. Do stávajícího ESP32 firmware doplňte základní URL a autentizační hlavičky dle [docs/ESP32_API.md](docs/ESP32_API.md). První `POST /status` zobrazí panel jako online.
9. V **Zprávy → Nová zpráva** vytvořte zprávu; ESP32 ji získá z `GET /messages/next`.
10. Po zobrazení musí firmware zavolat `delivered`, `displayed` a případně `acknowledged`. Stav se projeví v historii.

## Lokální vývoj

Vyžaduje pouze Node.js 20+. Databáze není potřeba:

```bash
npm install
npm run dev
```

Kontroly: `npm run typecheck`, `npm test`, `npm run build`.

## Proměnné prostředí

`NODE_ENV`, `PORT`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEVICE_ID`, `DEVICE_API_KEY`, `DEVICE_OFFLINE_SECONDS`, `APP_TIMEZONE`, `LOCATION_NAME`, `LOCATION_LATITUDE`, `LOCATION_LONGITUDE`, `WEATHER_CACHE_MINUTES`, `STATUS_HISTORY_INTERVAL_SECONDS`, `APP_BASE_URL`.

Cookies jsou HttpOnly/SameSite a v produkci Secure. Formuláře mají CSRF ochranu, vstupy jsou omezené a validované.

## Struktura

- `src/app.ts` – web, přihlášení a administrační routy
- `src/routes/device-api.ts` – kompletní pull API ESP32
- `src/services` – směny, počasí, jmeniny a LCD převod
- `src/views`, `src/public` – EJS rozhraní, responzivní CSS a JavaScript
- `src/store.ts` – dočasné úložiště dat v paměti procesu
- `docs/ESP32_API.md` – integrační smlouva pro firmware
- `tests` – automatické testy výpočtů a bezpečné konfigurace

## Co doplnit do ESP32

Heartbeat `POST /status`; polling `/messages/next`, `/commands/next` a `/config`; potvrzení stavů zprávy, příkazu a konfigurace; odesílání `/events`; kontrolu `/firmware/latest`; pětisekundový timeout, exponential backoff, neblokující síťovou úlohu a ukládání posledních ID do Preferences. Běžný lokální web, čas, směny, tlačítka a LCD cyklus zůstávají nezávislé na Railway.
