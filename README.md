# FieldShift

FieldShift recommends crops for a place in Ghana from NASA POWER agroclimate data. This repository is the Express API. A judge can get a live recommendation with no account.

The classifier is **k-nearest neighbours (k = 3)** over **12 NASA POWER reference hubs**. It is not a decision tree, and it is not a 16-hub model.

## What it does

You give a town in Ghana, or a latitude and longitude. The API returns:

- annual temperature, rainfall, and solar radiation from NASA POWER
- whether the point is inside the supported region (Ghana)
- an agroecological zone and a short crop list when it is
- the reference hub the point sits closest to, and how the zone vote split

The same assessment runs for the public demo and for the logged-in farm routes.

## How it works

1. **Place.** `lat` and `lng` are used as given. A `region` name is resolved with OpenStreetMap Nominatim, limited to Ghana (`countrycodes=gh`). If both are sent, the coordinates are the point that is assessed.
2. **NASA POWER.** The API requests the daily point endpoint for the **previous calendar year** (1 January through 31 December UTC). Community is `AG`. Parameters are `T2M` (temperature at 2 metres, °C), `PRECTOTCORR` (bias-corrected precipitation, mm/day), and `ALLSKY_SFC_SW_DWN` (all-sky surface shortwave downward irradiance, kWh/m²/day).
3. **Annual figures.** Temperature and solar radiation are the mean of valid days. Rainfall is annualised as `mean(valid PRECTOTCORR days) × 365`, so missing days do not shrink the yearly total. The NASA fill value `-999` is ignored.
4. **Ghana gate.** Points outside latitude 4.5–11.3 and longitude -3.4–1.4 return `supported: false`. Climate figures are still returned. No Ghana zone or crop list is assigned.
5. **k-NN.** Inside Ghana, the point is compared with 12 reference hubs. Each hub is a feature vector of average temperature, annual rainfall, average solar radiation, latitude, and longitude, scaled and weighted. The three nearest hubs vote for a zone, weighted by inverse distance. The winning zone supplies the crop list. Two lead crops stay fixed; the rest rotate by an 11 km cell so a place is stable from one request to the next.
6. **Hub climates.** On boot, each hub is loaded from the same NASA POWER request. If NASA is unavailable for a hub, that hub keeps its published baseline until a later retry. If NASA is unavailable for the requested point inside Ghana, the climate is estimated from nearby hubs and `provenance.source` says so.
7. **Live weather (optional).** When `OPENWEATHER_API_KEY` is set, current conditions from OpenWeatherMap are attached for context. The zone still comes from the annual NASA profile.

There are 11 zones and 12 hubs. Accra and Pokuase share the peri-urban savannah zone. The hubs are Kumasi, Takoradi, Sunyani, Tamale, Navrongo, Wa, Accra, Pokuase, Keta, Kpandai, Cape Coast, and Koforidua.

## Try the public demo

No `Authorization` header. No registration.

Base URL: `https://nasa-space-challenge-backend.onrender.com`

By town:

```bash
curl "https://nasa-space-challenge-backend.onrender.com/api/public/assess?region=Kumasi"
```

By coordinates (Kumasi):

```bash
curl "https://nasa-space-challenge-backend.onrender.com/api/public/assess?lat=6.6885&lng=-1.6244"
```

Other places worth trying: `region=Tamale`, `region=Navrongo`, and a point outside Ghana such as `lat=41.5868&lng=-93.625` (Des Moines). That last call returns HTTP 200 with `supported: false` and the NASA rainfall, and it does not assign a Ghana zone.

`GET /` on the same host returns a status payload with the classifier name and these paths.

The route is rate limited to **120 requests per 15 minutes per IP**. A limit hit returns HTTP 429 and `Retry-After`. The first request after the service has been idle can take a minute: the process starts, then loads the 12 reference hubs from NASA POWER.

Optional `start` and `end` (`YYYYMMDD`) select a different NASA window. Omit them to use the previous calendar year.

A successful body includes `climateSummary`, `moisture`, `provenance` (source, parameters, date range, community), and the crop result on both `recommendation` and `aiRecommendation` (the same object). `aiRecommendation` remains so the existing frontend can keep reading it. `recommendation.model` is `k-NN (k=3) over 12 NASA POWER reference hubs`.

## NASA data

| | |
| --- | --- |
| Product | [NASA POWER](https://power.larc.nasa.gov/) (Prediction Of Worldwide Energy Resources) |
| API docs | [POWER API documentation](https://power.larc.nasa.gov/docs/services/api/) |
| Daily point endpoint | `https://power.larc.nasa.gov/api/temporal/daily/point` |
| Community | `AG` (agroclimatology) |
| Parameters | `T2M`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN` |
| Default window | Previous calendar year, `YYYY0101` through `YYYY1231` |

FieldShift calls that endpoint directly. Responses include `provenance` so the parameter list and dates are visible on every assessment. Acknowledgements follow NASA POWER's [referencing guidance](https://power.larc.nasa.gov/docs/referencing/).

## Other resources

- [OpenWeatherMap Current Weather](https://openweathermap.org/current) — optional live conditions. Omitted when `OPENWEATHER_API_KEY` is unset.
- [OpenStreetMap Nominatim search](https://nominatim.org/release-docs/latest/api/Search/) — turns a Ghana place name into coordinates. Requests send a User-Agent and are spaced at least one second apart.
- Runtime libraries: Express 5, Mongoose, jsonwebtoken, bcrypt, cors, dotenv, morgan. Outbound HTTP uses Node's built-in `fetch`.

## Limitations

- **Ghana only.** Coordinates outside the box above are not given a zone or crops.
- **Annual, not seasonal.** The score uses one yearly profile (the previous calendar year by default). It does not model the major and minor rainy seasons, a forecast, or a particular planting date.
- **Zone and crop tables need a citation.** The zone paragraphs, crop lists, and reference-hub baselines in `src/services/nasaPowerService.js` (`CROP_MAP`, `REFERENCE_HUBS`) are project data, not a NASA product. **TODO (team):** cite the agronomic source for those tables before treating them as published guidance.
- The result is a transparent neighbour vote among 12 hubs, not a field survey and not a yield model.
- The public rate limit is in memory on this process. One Render instance is what the demo assumes.
- The public assessment does not read or write MongoDB. Starting the server still requires `MONGO_URI`, because the logged-in routes connect on boot.

## Use of AI

Cursor AI agents assisted with writing and refactoring code. The team designed the solution and the NASA data integration.

## Local setup

Node.js 20 or newer.

```bash
npm install
```

Create a `.env` file (do not commit it):

- `PORT` — HTTP port. Defaults to 5000.
- `MONGO_URI` — MongoDB connection string. Required to boot. The public assessment does not query it, but the process connects on startup because the logged-in routes use MongoDB.
- `JWT_SECRET` — required in production (`NODE_ENV=production`). The server exits on boot with a clear error if it is missing, so a deploy cannot silently sign tokens with a shared default. If this variable is already set (as on Render), that value is used unchanged. In local development only, an unset secret is replaced with a random process-local value and a loud warning. Tokens from that value die when the process exits.
- `OPENWEATHER_API_KEY` — optional.
- `CROP_DEBUG` — set to `1` for extra classifier logs.
- `PUBLIC_ASSESS_RATE_LIMIT` — optional override for the public demo cap (default 120 per 15 minutes).

```bash
npm start
```

`npm run dev` reloads with nodemon.

## Authenticated routes

These are unchanged and still require `Authorization: Bearer <token>`.

- `POST /api/auth/register` and `POST /api/auth/login` — public, account required for the routes below
- `GET /api/personal-recommendations` — dashboard, from the user's saved region
- `GET /api/climate-recommendations` — saved map pin
- `PUT /api/farm` — save the pin

Response field notes for the frontend are in [CHANGES.md](CHANGES.md).

## Tests

```bash
npm test
```

That checks zone agreement, the public demo (NASA and Nominatim are mocked), the rate limit, and the JWT secret rules. Nothing in `npm test` calls the network.

To also query NASA POWER for Kumasi and Iowa:

```bash
node scripts/check-zones.mjs --live
```
