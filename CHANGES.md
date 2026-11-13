# Changes

## 13 Nov 2026 — One zone per coordinate, and no Ghana zone outside Ghana

### Why

The same place was getting two different answers.

- `GET /api/personal-recommendations` (dashboard) geocoded the user's region, summed raw daily `PRECTOTCORR`, then called the classifier **without coordinates**. The classifier defaulted to Accra (`lat` 5.6, `lng` -0.2). Kumasi's climate was therefore scored as a coastal site. The zone text the UI showed is the Accra / peri-urban zone, whose explanation says "Coastal savannah".
- `GET /api/climate-recommendations` (map pin and AI page) passed the saved latitude and longitude and annualised rainfall as `mean(daily) × 365`. Kumasi then matched the Ashanti & Forest Zone reference station.

A second bug used the same Ghana-only nearest-hub model for the rest of the world. Iowa was snapped to the Upper West reference station, and that zone's fixed sentence ("Severe moisture deficit") was returned even when NASA POWER rainfall was about 914 mm. The moisture sentence was not computed from the rainfall.

Both routes now call `assessCoordinates` in `src/services/nasaPowerService.js`.

- One date window: the previous full calendar year, unless `start` and `end` are passed on the dashboard route.
- One rainfall figure: annualised millimetres, `mean(valid PRECTOTCORR days) × 365`.
- The real latitude and longitude are always passed in. Omitting them throws instead of assuming Accra.
- Points outside Ghana (`lat` 4.5–11.3, `lng` -3.4–1.4) return `supported: false` and do not receive a Ghana zone or crop list.
- The moisture sentence is chosen from that annualised rainfall, not from the zone paragraph.

### Files

- `src/services/nasaPowerService.js` — shared assessment, rainfall-based moisture, provenance, per-crop lines. The peri-urban zone label no longer has a leading space.
- `src/controllers/climateController.js` — both handlers return that assessment. Existing keys are unchanged; new keys are added.
- `scripts/check-zones.mjs` — Kumasi agrees across both response shapes; Iowa is unsupported.
- `package.json` — `npm start` and `npm test`.
- `README.md` — setup and a link here.

### Response fields

Existing keys are still there. These are the ones added on both `GET /api/personal-recommendations` and `GET /api/climate-recommendations`.

| Field | Meaning |
| --- | --- |
| `supported` | `true` inside Ghana, `false` otherwise |
| `message` | `null` inside Ghana. Outside Ghana, a short explanation and no zone |
| `provenance.source` | `"NASA POWER"`, or `"Regional baseline estimate"` when NASA was down and the point is inside Ghana |
| `provenance.parameters` | `["T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"]` |
| `provenance.dateRange` | `{ "start": "YYYYMMDD", "end": "YYYYMMDD" }` |
| `provenance.community` | `"AG"` |
| `moisture.level` | `severe deficit`, `low`, `moderate`, `high`, or `very high` |
| `moisture.annualRainfallMm` | rounded annualised rainfall |
| `moisture.summary` | one sentence that quotes that rainfall |
| `warnings` | human-readable notes. Includes `message` when unsupported |
| `dataSource` | already on the map route; now also on the dashboard route |
| `aiRecommendation.zone` | short zone name, or `null` outside Ghana |
| `aiRecommendation.zoneId` | reference-zone id, or `null` |
| `aiRecommendation.confidence` | number from the hub vote, or `null` |
| `aiRecommendation.crops` | `{ name, reason, confidence }[]`. Empty outside Ghana |
| `aiRecommendation.supported` | same flag as the top-level `supported` |

`aiRecommendation.confidenceScore` is still the string `"Dynamic Leaf Assessment"` inside Ghana. Outside Ghana it is `"Unavailable outside supported region"`.

`climateSummary.totalPrecipitationMm` is now the same annualised whole-millimetre value on both routes. The dashboard used to return the raw sum of daily values, which under-counted years with missing days.

Bands used for `moisture.level`: under 600 mm severe deficit, 600–899 low, 900–1199 moderate, 1200–1599 high, 1600 mm and above very high. 914 mm is moderate.

### Example: Kumasi (inside Ghana)

`aiRecommendation.crop` (dashboard) and `aiRecommendation.suggestedAdaptiveCrop` (map) are the same string.

```json
{
  "success": true,
  "supported": true,
  "message": null,
  "dataSource": "NASA POWER Satellite Telemetry",
  "provenance": {
    "source": "NASA POWER",
    "parameters": ["T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"],
    "dateRange": { "start": "20250101", "end": "20251231" },
    "community": "AG"
  },
  "climateSummary": {
    "averageTemperatureC": 26.5,
    "totalPrecipitationMm": 1500,
    "averageSolarRadiation": 4.8
  },
  "moisture": {
    "level": "high",
    "annualRainfallMm": 1500,
    "summary": "Annual rainfall is 1500 mm, high moisture."
  },
  "warnings": [],
  "aiRecommendation": {
    "crop": "Ashanti & Forest Zone (Cocoa, Plantain, Yellow Yam, Maize)",
    "suggestedAdaptiveCrop": "Ashanti & Forest Zone (Cocoa, Plantain, Yellow Yam, Maize)",
    "zone": "Ashanti & Forest Zone",
    "zoneId": 0,
    "confidenceScore": "Dynamic Leaf Assessment",
    "confidence": 0.99,
    "reasoning": "High annual precipitation (>1,300mm) and dense canopy moisture profiles typical of the middle forest belt. Annual rainfall is 1500 mm, high moisture.",
    "crops": [
      {
        "name": "Cocoa",
        "confidence": 0.99,
        "reason": "Cocoa is a lead crop for Ashanti & Forest Zone. Annual rainfall is 1500 mm, high moisture."
      }
    ]
  }
}
```

The dashboard body uses `farm` and `aiRecommendation.crop` / `model`. The map body uses `farmDetails`, `liveWeather`, and `aiRecommendation.suggestedAdaptiveCrop` / `modelEngine`. The example above only shows the shared zone fields. Crop order inside the parentheses still depends on the 11 km cell, and it is stable for a given coordinate.

### Example: Iowa (outside Ghana)

No Upper West zone, and no "severe moisture deficit" sentence. The NASA rainfall is still returned.

```json
{
  "success": true,
  "supported": false,
  "message": "These coordinates are outside Ghana. FieldShift agroecological zones and crop recommendations cover Ghana only, so no zone was assigned.",
  "provenance": {
    "source": "NASA POWER",
    "parameters": ["T2M", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"],
    "dateRange": { "start": "20250101", "end": "20251231" },
    "community": "AG"
  },
  "climateSummary": {
    "averageTemperatureC": 10.2,
    "totalPrecipitationMm": 914,
    "averageSolarRadiation": 3.6
  },
  "moisture": {
    "level": "moderate",
    "annualRainfallMm": 914,
    "summary": "Annual rainfall is 914 mm, moderate moisture for a single rainy season."
  },
  "aiRecommendation": {
    "crop": "Unsupported location",
    "suggestedAdaptiveCrop": "Unsupported location",
    "zone": null,
    "zoneId": null,
    "confidenceScore": "Unavailable outside supported region",
    "confidence": null,
    "reasoning": "These coordinates are outside Ghana. FieldShift agroecological zones and crop recommendations cover Ghana only, so no zone was assigned. Annual rainfall is 914 mm, moderate moisture for a single rainy season.",
    "crops": []
  }
}
```

HTTP status stays 200. `success` stays `true` because the request worked. Clients that only checked `success` will not treat this as a server error.

`npm test` locks the 1,500 mm Kumasi reference profile and the 914 mm Iowa profile above. A live NASA POWER check for calendar 2025 returned 1,800 mm for Kumasi (still Ashanti & Forest Zone on both routes) and 809 mm for Des Moines, Iowa (`moisture.level` `low`, `supported: false`). The phrase "severe moisture deficit" is used only when annual rainfall is under 600 mm.

### What the frontend should update

The live app (`DashboardPage` and `AiRecommendationsPage`) can keep reading the old keys. For the new behaviour:

1. If `supported` is `false`, show `message` and `moisture.summary`. Do not present `aiRecommendation.crop` or `suggestedAdaptiveCrop` as a Ghana zone. Both are the literal string `"Unsupported location"`.
2. Show `provenance.source`, `provenance.parameters`, and `provenance.dateRange` next to the climate figures.
3. Render `aiRecommendation.crops` as the per-crop list (`name`, `reason`, `confidence`). `confidence` is a 0–1 vote share, separate from the old `confidenceScore` string.
4. Treat `climateSummary.totalPrecipitationMm` as annualised millimetres on the dashboard as well as the map. The dashboard label already says "Annualized Rainfall".
5. Kumasi (and any other coordinate) now produces the same zone string on `/api/personal-recommendations` and `/api/climate-recommendations`.

Region search is still limited to Ghana. A name that cannot be geocoded still falls back to Accra, as before. A map pin outside Ghana is what returns `supported: false`.
