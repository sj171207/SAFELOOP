# 🛡️ SafeLoop

**Smart road safety system for reporting hazards, real-time alerts, and emergency coordination.**

SafeLoop lets drivers and pedestrians report road hazards — accidents, potholes, construction, bad weather, and more — and see them plotted live on a shared map. An AI image check helps filter out fake or AI-generated submissions, and an AI-generated alerts panel summarizes nearby risks for anyone checking the app before they head out.

## ✨ Features

- **Live Safety Map** — All reports are pinned on an interactive map (MapLibre), color-coded by hazard type, alongside your current location.
- **Report a Hazard** — Submit a report with a photo, description, and location. Location is auto-detected via geolocation and reverse-geocoded into a readable address, with a manual search/autocomplete fallback if GPS isn't available.
- **AI Image Verification** — Every uploaded photo is checked by Gemini to flag images that look AI-generated or fake rather than a genuine photo of the hazard.
- **Live Alerts** — Gemini generates a short, location-aware safety summary (with severity levels) based on hazard reports near you.
- **Dashboard** — At-a-glance stats on total reports and a breakdown by hazard type.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Map | MapLibre GL via `react-map-gl` |
| AI | Google Gemini API (`@google/genai`) |
| Charts | Recharts |
| Animation | Motion (Framer Motion) |
| Backend | Express |
| Database | SQLite (`better-sqlite3`) |
| Geocoding | Geoapify |

> Scaffolded from the [google-gemini/aistudio-repository-template](https://github.com/google-gemini/aistudio-repository-template).

## 📁 Project Structure

```
SAFELOOP/
├── server.ts            # Express server, SQLite setup, REST API routes
├── index.html           # App entry HTML
├── metadata.json         # App name, description, requested permissions
├── src/
│   ├── App.tsx           # Main app: navbar, map, report form, dashboard, alerts
│   ├── main.tsx          # React entry point
│   ├── types.ts          # Shared TypeScript types (User, Report, SafetyAlert)
│   ├── index.css         # Global styles (Tailwind)
│   └── lib/
│       ├── gemini.ts      # Gemini calls: AI image check, safety alerts
│       └── utils.ts       # Helper utilities
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A [Geoapify API key](https://www.geoapify.com/) (for reverse geocoding / address search)

### Installation

```bash
git clone https://github.com/sj171207/SAFELOOP.git
cd SAFELOOP
npm install
```

### Configure environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Required for Gemini AI calls (image verification, safety alerts) |
| `GEOAPIFY_API_KEY` | Required for reverse geocoding and address autocomplete on the map |
| `APP_URL` | URL where the app is hosted (used for self-referential links) |

### Run in development

```bash
npm run dev
```

This starts the Express server with Vite in middleware mode at `http://localhost:3000`.

### Build for production

```bash
npm run build
npm start
```

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Register/update a user |
| `GET` | `/api/reports` | List all hazard reports |
| `POST` | `/api/reports` | Submit a new hazard report |
| `GET` | `/api/stats` | Total report count and breakdown by type |

## 🔐 Permissions

SafeLoop requests the following browser permissions (see `metadata.json`):

- **Camera** — to capture hazard photos directly
- **Microphone** — reserved for future voice-reporting features
- **Geolocation** — to auto-detect your location for reports and the live map

## 📝 Notes

- Authentication is currently a mock login for demo purposes — it registers a fixed demo user against the database rather than performing real OAuth.
- Reports are stored locally in a SQLite file (`safeloop.db`), created automatically on first run.

## 🗺️ Roadmap

- [ ] Real OAuth-based authentication
- [ ] Report verification / moderation workflow (status: pending → verified → resolved)
- [ ] Push notifications for nearby hazards
- [ ] Voice-based hazard reporting

## 📄 License

No license has been specified for this project yet.
