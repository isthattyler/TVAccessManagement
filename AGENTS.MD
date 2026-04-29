# Agent Guide: TradingView Node.js Manager

## Overview
This repository is a Node.js backend that manages TradingView Pine Script access. It is a functional drop-in replacement for older Python versions.

## Setup & Execution Workflow
1.  **Install Dependencies**: Must run `npm install` first.
2.  **Environment Variables**: A local `.env` file *must* be created containing `TV_USERNAME` and `TV_PASSWORD` before starting the service.
3.  **Execution**:
    *   For development: `npm run dev` (uses nodemon for auto-restart).
    *   For production: `npm start`.

## Architecture
```
src/
  server.js        — Express server entry point
  routes.js        — All API route definitions
  tradingview.js   — TradingView API client (login, access management)
  config.js        — API URLs, defaults, Pine script name mappings
  session.js       — Session persistence (disk cache, validation)
  helper.js        — Date math, duration parsing
  logger.js        — Access logging to JSON file
```

## Critical Quirks & Gotchas
*   **Secrets**: Credentials (`TV_PASSWORD`) are never exposed in API responses.
*   **Session Management**: The session ID is volatile; the system automatically attempts re-login upon request failure.
*   **Endpoints**:
    *   Validation: `GET /validate/:username`
    *   Actions (Get/Post/Delete): Use `/access/:username`
    *   Post requests require structured JSON bodies defining `pine_ids` and an optional `duration`.
*   **Time Durations (POST)**: Use explicit formats (e.g., `30D` for 30 days, `6M` for 6 months, `L` for lifetime).

## Commands
*   **Start Dev**: `npm run dev`
*   **Install**: `npm install`
*   **Verify API**: Test endpoints using `curl` with the correct headers/payloads defined in the README.md.
