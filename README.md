# BotForge — Discord Bot Host

A Docker-based web GUI to host, manage, and monitor your Discord bot.

## 🚀 Quick Start

### Option A — Docker Compose (recommended)
```bash
docker-compose up -d
```

### Option B — Docker CLI
```bash
docker build -t discord-bot-host .
docker run -d \
  -p 3000:3000 \
  -v discord-bot-data:/bot-data \
  --name discord-bot-host \
  --restart unless-stopped \
  discord-bot-host
```

Then open: **http://localhost:3000**

---

## 📋 Features

| Feature | Details |
|---|---|
| **Live Logs** | Real-time bot stdout/stderr via WebSocket |
| **Code Editor** | Edit & save `bot.js` in-browser |
| **Env Vars** | Manage `.env` variables (token, etc.) with a GUI |
| **Bot Controls** | Start / Stop / Restart with one click |
| **Auto-scroll** | Toggle log auto-scroll |
| **Persistence** | All data saved to Docker volume `/bot-data` |

---

## 🔧 Setup Your Bot

1. **Add your bot token** → Go to *Env Vars*, add `DISCORD_TOKEN=your_token_here`, click Save
2. **Paste your code** → Go to *Bot Code*, paste your `bot.js`, click Save (or Ctrl+S)
3. **Start it** → Click **▶ Start Bot** in the sidebar

### Need discord.js in your bot?

Your bot runs in Node.js inside the container. To install discord.js, either:

**A) Extend the Dockerfile:**
```dockerfile
RUN npm install discord.js
```

**B) Or exec into the container:**
```bash
docker exec -it discord-bot-host sh
cd /bot-data && npm install discord.js
```

Then reference it normally in your bot code.

---

## 📁 Data Volume

Everything in `/bot-data` persists across container restarts:
- `bot.js` — your bot code
- `.env` — environment variables
- `bot.log` — last 500 log lines

---

## 🔒 Security Note

The web GUI has **no authentication** by default. If exposing beyond localhost, put it behind a reverse proxy with auth (nginx, Caddy, Traefik, etc.).
