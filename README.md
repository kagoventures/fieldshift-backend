# FieldShift backend

Express API for the FieldShift NASA Space Apps challenge. It reads NASA POWER agroclimate data and recommends crops for farms in Ghana.

What changed, and what the frontend needs to read, is in [CHANGES.md](CHANGES.md).

## Setup

Use Node.js 20 or newer.

```bash
npm install
```

Create a `.env` file in this directory. The server reads these names:

- `PORT` — HTTP port. Defaults to 5000 when unset.
- `MONGO_URI` — MongoDB connection string. Required.
- `JWT_SECRET` — secret used to sign login tokens.
- `OPENWEATHER_API_KEY` — optional. Live weather is left out when unset.
- `CROP_DEBUG` — optional. Set to `1` for extra crop-model logs.

Do not commit `.env`.

## Run

```bash
npm start
```

For reload during development:

```bash
npm run dev
```

On boot the process connects to MongoDB, builds the crop model, then listens. `GET /` returns a short status payload.

## Zone check

```bash
npm test
```

`scripts/check-zones.mjs` checks that Kumasi gets the same zone from the dashboard response and the map response, and that a point in Iowa is `supported: false`. To also query NASA POWER:

```bash
node scripts/check-zones.mjs --live
```

## Routes

`POST /api/auth/register` and `POST /api/auth/login` are public. Every other `/api` route expects `Authorization: Bearer <token>`.

- `GET /api/personal-recommendations` — dashboard, from the user's saved region
- `GET /api/climate-recommendations` — saved map pin
- `PUT /api/farm` — save the pin
