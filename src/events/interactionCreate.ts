import { Interaction } from 'discord.js';
import { EventHandler } from '../types';
import { handleCommand } from '../commands';
import logger from '../utils/logger';
import { handleMaidButton } from '../utils/maidFeatures';

export const interactionCreateEvent: EventHandler = {
  name: 'interactionCreate',

  async execute(interaction: Interaction) {
    try {
      if (interaction.isCommand()) {
        await handleCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleMaidButton(interaction);
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);

      if (interaction.isRepliable()) {
        const message = 'เกิดข้อผิดพลาดชั่วคราวครับ กรุณาลองใหม่อีกครั้ง';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
        } else {
          await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        }
      }
    }
  },
};