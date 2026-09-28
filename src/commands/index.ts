import { REST, Routes, CommandInteraction } from 'discord.js';
import config from '../config/config';
import logger from '../utils/logger';
import { maidCommand } from './maid/maid';
import { helpCommand } from './maid/help';
import { CommandHandler } from '../types';
import adminCommand from './admin';
import { hugCommand, kissCommand } from './maid/affection';
import inviteCommand from './invite';

// ===========================
// Command Registry
// ===========================

export const commands: CommandHandler[] = [
  maidCommand,
  helpCommand,
  adminCommand,
  hugCommand,
  kissCommand,
  inviteCommand,
];

// ===========================
// Command Deployment
// ===========================

export async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info('🔄 Reloading slash commands...');

    const commandData = commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      options: cmd.options || [],
    }));

    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commandData }
    );

    logger.info(`✅ Deployed ${commandData.length} slash commands`);
  } catch (error) {
    logger.error('❌ Failed to deploy commands:', error);
    throw error;
  }
}

// ===========================
// Command Executor
// ===========================

export async function handleCommand(interaction: CommandInteraction) {
  const command = commands.find((cmd) => cmd.name === interaction.commandName);

  if (!command) {
    await interaction.reply('❌ คำสั่งนี้ไม่พบครับ');
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`❌ Error executing command ${interaction.commandName}:`, error);
    if (interaction.replied) {
      await interaction.followUp('❌ เกิดข้อผิดพลาดครับ');
    } else {
      await interaction.reply('❌ เกิดข้อผิดพลาดครับ');
    }
  }
}