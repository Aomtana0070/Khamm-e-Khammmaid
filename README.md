# 🎀 Khammée Khammmaid Café Bot

> ยินดีต้อนรับสู่ร้านของผมครับ ☕

A cute Japanese-inspired Maid Café Discord bot with economy, jobs, quests, cards, and RPG features.

## ☁️ Run 24/7 Without `npm run dev`

For always-on hosting, deploy the bot to a cloud VM rather than a free web service that sleeps when it has no HTTP traffic. The included Docker Compose setup runs the compiled production build, restarts it after a crash or VM reboot, and stores the SQLite database in a persistent volume.

Oracle Cloud offers an Always Free VM tier in supported regions, but availability and terms can change and account verification may require a payment card. Choose an Always Free shape and monitor the account so you do not enable paid resources accidentally.

1. Create an Always Free Ubuntu VM with your cloud provider and allow SSH access.
2. Install Git, Docker Engine, and the Docker Compose plugin on the VM.
3. Clone this repository onto the VM and enter its directory.
4. Create the environment file and set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`:

```bash
cp .env.example .env
nano .env
```

Never commit or share `.env`. Docker Compose keeps the production SQLite database at `/data/cafe.db` in its persistent volume, regardless of the local development database URL in `.env`.

5. Start the production container:

```bash
docker compose up -d --build
```

The container runs Prisma schema synchronization and then `npm start`; it does not run `npm run dev`. The database persists in the `cafe-data` Docker volume. View logs with `docker compose logs -f maid-bot`, stop with `docker compose down`, and deploy updates with `git pull` followed by `docker compose up -d --build`.

The VM must remain within the provider's free-tier limits and stay powered on. This setup cannot be deployed from this workspace because it requires your cloud account and Discord credentials.

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Discord Bot Token
- Discord Application ID

### Installation

1. **Clone or create project**
```bash
mkdir khammee-khammmaid
cd khammee-khammmaid
```

2. **Initialize npm**
```bash
npm init -y
```

3. **Install dependencies**
```bash
npm install discord.js @prisma/client dotenv winston zod
npm install -D typescript @types/node ts-node prisma
```

4. **Create directory structure**
```bash
mkdir -p src/{commands/maid,events,database,utils,config,types}
mkdir -p prisma
```

5. **Create .env file**
```bash
cp .env.example .env
# Edit .env with your values
```

6. **Initialize Prisma**
```bash
npx prisma init
```

7. **Setup database**
```bash
npm run db:push
```

8. **Deploy slash commands**
```bash
npm run deploy-commands
```

9. **Run bot**
```bash
npm run dev
```

---

## 🤖 Discord Bot Setup

### Create Bot on Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "Khammée Khammmaid"
4. Go to "Bot" → Click "Add Bot"
5. Copy the **TOKEN** → paste in `.env` as `DISCORD_TOKEN`
6. Copy the **CLIENT ID** → paste in `.env`

### Required Permissions