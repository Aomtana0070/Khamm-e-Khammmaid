import { ActivityType, Client } from 'discord.js';
import { EventHandler } from '../types';
import logger from '../utils/logger';

export const readyEvent: EventHandler = {
  name: 'ready',
  once: true,

  async execute(client: Client) {
    logger.info(`✅ Bot logged in as ${client.user?.tag}`);
    logger.info(`🎀 Khammée Khammmaid Café is online!`);

    // Set presence
    client.user?.setActivity('🎀 Khammée Khammmaid Café', {
      type: ActivityType.Watching,
    });

    logger.info(`📊 Connected to ${client.guilds.cache.size} server(s)`);
  },
};