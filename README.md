# TravelPlanner

A personal travel itinerary planner and tracker built with React, Firebase, and AI-powered suggestions via Google Gemini.

## Features

- **Itinerary management** — Create trips with day-by-day activity planning, categories, costs, and notes
- **Calendar view** — Visualize trips and activities in day, week, month, or trip-scoped calendar views
- **Transportation tracking** — Log flights, trains, buses, and other transport with costs and booking references
- **AI suggestions** — Get activity and transport recommendations powered by Google Gemini (via Cloudflare Worker proxy)
- **Theming** — Choose from built-in theme presets (Modern, Y2K Retro, Dark, Sunset, Ocean) or customize colors
- **Mobile-friendly** — Responsive layout with collapsible sidebar

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Routing | react-router-dom |
| Database | Firebase Firestore (real-time sync) |
| AI Proxy | Cloudflare Worker + Google Gemini |
| Icons | lucide-react |
| Dates | date-fns |

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project with Firestore enabled
- (Optional) A Cloudflare account for the AI proxy worker

### Environment Variables

Create a `.env` file in the project root:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_AI_PROXY_URL=https://your-worker.workers.dev
```

### Local Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm run preview   # preview the production build locally
```

### AI Proxy Worker

The Cloudflare Worker in `worker/` proxies requests to Google Gemini. To deploy:

```bash
cd worker
npx wrangler deploy
```

Set the `GEMINI_API_KEY` secret in your Cloudflare dashboard.

## Deployment

The app deploys to GitHub Pages automatically on push to `main` via the workflow in `.github/workflows/deploy.yml`. Make sure the required `VITE_*` secrets are configured in your repository settings.

## Project Structure

```
src/
  components/     — Reusable UI components (Sidebar, TripForm, ActivityForm)
  design-system/  — Theme presets and token management
  lib/            — Firebase config, Firestore hooks, Gemini client, types
  pages/          — Route-level page components
  theme.css       — Base design tokens and global styles
worker/           — Cloudflare Worker for Gemini API proxy
```
