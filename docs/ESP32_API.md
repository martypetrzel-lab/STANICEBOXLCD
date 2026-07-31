# StaniceBox – API pro ESP32

Základní cesta je `/api/device/v1`. Všechny požadavky posílají hlavičky `X-Device-ID` a `X-API-Key`; klíč nikdy neposílejte v URL. Tělo i odpověď jsou JSON. Úspěch obsahuje `success: true`. Chyba autentizace je `401` s `INVALID_DEVICE_CREDENTIALS`, chybějící objekt `404`, neplatné tělo `400` a interní chyba `500`.

## Doporučené chování firmware

- HTTP timeout 5 sekund, komunikace neblokující hlavní LCD smyčku.
- Status odesílat po 30–60 s; zprávy, příkazy a konfiguraci kontrolovat po 10–20 s.
- Při chybě použít exponenciální prodlevu (15, 30, 60, 120 s; maximum 10 minut).
- Po návratu Wi‑Fi automaticky pokračovat. Běžné funkce panelu nesmějí záviset na Railway.
- Poslední ID zprávy, příkazu a verzi konfigurace uložit do ESP32 `Preferences`.
- Potvrzovací volání lze bezpečně opakovat; server zachová první čas události.

## Stav zařízení

### `POST /status`

Požadavek:

```json
{"firmwareVersion":"0.8.3-cloud","localIp":"192.168.1.120","wifiSsid":"Hasici","wifiRssi":-61,"batteryVoltage":4.02,"batteryPercent":84,"powerSource":"USB","uptimeSeconds":123456,"freeHeap":180000,"currentShift":"A","currentScreen":"weather","backlightOn":true,"lastEvent":"Počasí aktualizováno","lastError":null}
```

Odpověď: `{"success":true,"serverTime":"2026-07-30T10:00:00.000Z","messageAvailable":true,"commandAvailable":false,"configurationVersion":3,"firmwareAvailable":false,"shiftMismatch":false}`. Endpoint vždy aktualizuje `lastSeenAt`; historický vzorek vznikne nejvýše jednou za nastavený interval.

## Zprávy

### `GET /messages/next`

Bez těla. Vrací `{"success":true,"message":null,"pollAfterSeconds":15}` nebo zprávu s poli `id`, `title`, `body`, `lcdTitle`, `lcdBody`, `lcdLines`, `priority`, `displayMode`, `durationSeconds`, `requireAcknowledgement`, `beepEnabled`, `startsAt`, `expiresAt`.

### Potvrzení zprávy

- `POST /messages/:id/delivered` – staženo do ESP32.
- `POST /messages/:id/displayed` – fyzicky zobrazeno.
- `POST /messages/:id/acknowledged` – potvrzeno tlačítkem.
- `POST /messages/:id/cleared` – odstraněno z LCD / dokončeno.

Tělo je prázdné `{}`. Odpověď obsahuje `success` a `delivery`. Volání jsou idempotentní. Neznámé ID vrací `404 MESSAGE_NOT_FOUND`.

### `GET /messages/:id/status`

Vrací objekt s `id`, `status` a `expiresAt`, nebo `message: null`, pokud byla zpráva odstraněna. Firmware před dlouhodobým STICKY zobrazením ověřuje, že zpráva nebyla zrušena.

## Konfigurace

### `GET /config`

Vrací `configuration: null` nebo objekt `{"version":3,"settings":{...},"status":"PENDING"}`.

- `POST /config/:version/downloaded`
- `POST /config/:version/applied`
- `POST /config/:version/failed`

První dvě volání přijímají `{}`; `failed` přijímá `{"error":"popis"}`. Odpověď vrací aktualizovanou konfiguraci. Nastavení použijte atomicky a `applied` odešlete až po úspěšném uložení do Preferences.

## Příkazy

### `GET /commands/next`

Vrací nejstarší čekající příkaz: `{"success":true,"command":{"id":"uuid","type":"NEXT_PAGE","payload":null},"pollAfterSeconds":15}` nebo `command: null`.

- `POST /commands/:id/downloaded`
- `POST /commands/:id/executed`
- `POST /commands/:id/failed` s volitelným `{"error":"popis"}`

Podporované typy: `SHOW_INFO`, `NEXT_PAGE`, `BACKLIGHT_ON`, `BACKLIGHT_OFF`, `RECONNECT_WIFI`, `RESTART_DEVICE`, `CLEAR_MESSAGE`, `REFRESH_WEATHER`, `REFRESH_NAMEDAY`.

## Události

### `POST /events`

```json
{"type":"POWER_SOURCE_CHANGED","severity":"INFO","message":"Napájení přepnuto na baterii","data":{"from":"USB","to":"BATTERY"}}
```

Vrací `201 {"success":true,"eventId":"uuid"}`. `severity` je `INFO`, `WARNING`, `ERROR` nebo `CRITICAL`.

## Firmware

### `GET /firmware/latest`

Vrátí aktivní verzi a zabezpečené `downloadUrl`, nebo `firmware: null`. Firmware porovná verzi a hash, ale aktualizaci nespouští bez rozhodnutí administrátora.

### `GET /firmware/:id/download`

Vrací binární `application/octet-stream`; hlavička `X-Firmware-SHA256` obsahuje kontrolní hash. I stažení vyžaduje autentizační hlavičky.

## Kalendářní upozornění

### `GET /calendar/notifications/next`

Vrací nejbližší platné upozornění pro aktuální směnu zařízení nebo směnu `ALL`. Objekt obsahuje `id`, `eventId`, `type`, `title`, `body`, `person`, `targetShift`, `priority`, `beepEnabled`, `requireAcknowledgement`, `durationSeconds`, `startsAt`, `expiresAt` a přesně čtyři `lcdLines` s maximálně 20 znaky. Když nic nečeká, vrátí `notification: null` a `pollAfterSeconds: 30`.

Potvrzení jsou idempotentní:

- `POST /calendar/notifications/:id/downloaded`
- `POST /calendar/notifications/:id/displayed`
- `POST /calendar/notifications/:id/acknowledged`
- `POST /calendar/notifications/:id/cleared`
- `POST /calendar/notifications/:id/failed` s volitelným `{"error":"popis"}`

Stav ověří `GET /calendar/notifications/:id/status`. Firmware má kalendář kontrolovat přibližně po 30 sekundách a nedoručovat záznam ve stavu `CANCELLED`, `EXPIRED` nebo `COMPLETED`.

## Příklad

```bash
curl -X GET "https://example.up.railway.app/api/device/v1/messages/next" \
  -H "X-Device-ID: stanicebox-01" \
  -H "X-API-Key: vase-dlouhe-tajemstvi"
```
