import { Client, GatewayIntentBits } from 'discord.js';
import config from './config/config';
import logger from './utils/logger';
import prisma from './database/prisma';
import { deployCommands } from './commands';
import { readyEvent } from './events/ready';
import { interactionCreateEvent } from './events/interactionCreate';
import { startMaidEvents } from './events/maidEvents';

// ===========================
// Initialize Bot
// ===========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// ===========================
// Event Handlers
// ===========================

client.once('clientReady', () => readyEvent.execute(client));
client.on('interactionCreate', (interaction) => interactionCreateEvent.execute(interaction));
startMaidEvents(client);

// ===========================
// Error Handling
// ===========================

process.on('unhandledRejection', (error: Error) => {
  logger.error('❌ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// ===========================
// Graceful Shutdown
// ===========================

process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');
  await client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

// ===========================
// Startup
// ===========================

async function start() {
  try {
    logger.info('🎀 Starting Khammée Khammmaid Café...');
    
    // Deploy slash commands
    await deployCommands();

    // Connect to Discord
    await client.login(config.DISCORD_TOKEN);

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();