# TradingView Pine Script Access Manager (Node.js)

A clean, fast, and production-ready **Node.js** backend that automates granting, extending, and revoking access to your private TradingView Pine Script indicators/scripts — perfect for paid communities, automated subscription systems, or membership bots.

This is a full 1-to-1 rewrite of the popular Replit/Flask Python versions, but now using modern JavaScript (ESM), Express, Axios, and proper session handling.

## Features

- Automatic login & session management (stores `sessionid` in memory, re-logs in if expired)
- Validate TradingView usernames
- Check current access status for multiple Pine Scripts at once
- Grant new access or extend existing access (days, weeks, months, years, or lifetime)
- Revoke access instantly
- Exact same API endpoints as the original Python version — drop-in replacement
- Zero external database needed (session stored in memory; survives restarts via re-login)
- Ready for deployment on Render, Railway, Fly.io, VPS, etc.

## API Endpoints

| Method | Endpoint                  | Description                                                                 | Example Body / Params |
|--------|---------------------------|-----------------------------------------------------------------------------|-----------------------|
| GET    | `/`                       | Health check                                                                | → "Your bot is alive!" |
| GET    | `/validate/:username`     | Check if a TradingView username exists                                      | `/validate/johndoe123` |
| GET    | `/access/:username`       | Get current access details for one or more Pine Scripts                     | `{ "pine_ids": ["PH123456", "PH789012"] }` |
| POST   | `/access/:username`       | Grant or extend access                                                      | `{ "pine_ids": [...], "duration": "6M" }` or `"L"` for lifetime |
| DELETE | `/access/:username`       | Revoke access completely                                                   | `{ "pine_ids": [...] }` |

### Duration Format (POST)
- `30D` → 30 days  
- `12W` → 12 weeks  
- `6M` → 6 months  
- `1Y` → 1 year  
- `L`  → Lifetime (no expiration)

## Project Structure

```
tradingview-node/
├── src/
│   ├── config.js          → All TradingView endpoints
│   ├── helper.js          → Date extension logic
│   ├── tradingview.js     → Core class with session & API methods
│   ├── routes.js          → All Express routes
│   └── server.js          → Entry point
├── .env                   → Your credentials (never commit!)
├── package.json
└── README.md              → This file
```

## Installation & Setup

1. **Clone or download the project**
   ```bash
   git clone https://github.com/yourusername/tradingview-node.git
   cd tradingview-node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file in the root**
   ```env
   TV_USERNAME=your_tradingview_email_or_username
   TV_PASSWORD=your_tradingview_password
   PORT=5000
   ```

   > Warning: Use a dedicated TradingView account if this will run 24/7. Never use your main personal account.

4. **Start the server**
   ```bash
   npm run dev    # with auto-restart (nodemon)
   # or
   npm start      # production
   ```

   Server will be available at `http://localhost:5000`

## Example Usage (cURL)

```bash
# Validate username
curl http://localhost:5000/validate/someuser123

# Check current access
curl -X GET http://localhost:5000/access/someuser123 \
  -H "Content-Type: application/json" \
  -d '{"pine_ids": ["PH123456789", "PH987654321"]}'

# Grant 6 months access
curl -X POST http://localhost:5000/access/someuser123 \
  -H "Content-Type: application/json" \
  -d '{"pine_ids": ["PH123456789"], "duration": "6M"}'

# Grant lifetime access
curl -X POST http://localhost:5000/access/someuser123 \
  -H "Content-Type: application/json" \
  -d '{"pine_ids": ["PH123456789"], "duration": "L"}'

# Revoke access
curl -X DELETE http://localhost:5000/access/someuser123 \
  -H "Content-Type: application/json" \
  -d '{"pine_ids": ["PH123456789"]}'
```

## Deployment Options

### Render / Railway / Fly.io
- Set the same environment variables in the dashboard
- Start command: `node src/server.js`
- Port: automatically detected from `PORT` env var

### Docker (optional)

```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 5000
CMD ["node", "src/server.js"]
```

## Security Notes

- Your TradingView password is only used during login — never exposed in responses
- Session cookie is kept in memory (not written to disk)
- Always run behind HTTPS in production
- Rate-limit public endpoints if exposing to users
- Consider adding API key authentication if this is public-facing

## Troubleshooting

| Issue                          | Solution |
|--------------------------------|---------|
| `Login failed – no sessionid`  | Check username/password, disable 2FA on the account, or solve CAPTCHA manually once in browser |
| 403 / 401 errors               | Session expired → script will auto re-login on next request |
| User not found                 | Username is case-sensitive on TradingView — use exact spelling |

## Contributing

Pull requests are welcome! Especially for:
- Redis session caching
- Rate limiting / auth middleware
- Web dashboard
- TypeScript conversion

## License

MIT © 2025 – Feel free to use, modify, and redistribute.

---

**You now have a faster, cleaner, and more reliable alternative to the old Python Replit bots.**

Enjoy automated Pine Script access management! 🚀