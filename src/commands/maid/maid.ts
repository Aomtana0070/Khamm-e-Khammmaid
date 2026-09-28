import { CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CommandHandler } from '../../types';
import CafeEmbed from '../../utils/embeds';
import logger from '../../utils/logger';
import prisma from '../../database/prisma';

export const maidCommand: CommandHandler = {
  name: 'maid',
  description: 'Welcome to Khammée Khammmaid Café',
  
  async execute(interaction: CommandInteraction) {
    try {
      await interaction.deferReply();

      const userId = interaction.user.id;
      const guildId = interaction.guildId;

      if (!guildId) {
        await interaction.editReply({
          embeds: [CafeEmbed.error('Error', 'This command can only be used in a server.')],
        });
        return;
      }

      const guildName = interaction.guild?.name ?? guildId;

      // Ensure the guild exists before creating its user profile.
      await prisma.guild.upsert({
        where: { id: guildId },
        update: {
          name: guildName,
        },
        create: {
          id: guildId,
          name: guildName,
        },
      });

      // Get or create user
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userId,
            username: interaction.user.username,
            avatar: interaction.user.avatarURL(),
          },
        });
        logger.info(`✨ New user created: ${user.username} (${userId})`);
      }

      // Get or create user guild data
      let userGuild = await prisma.userGuild.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!userGuild) {
        userGuild = await prisma.userGuild.create({
          data: {
            userId,
            guildId,
            money: 500,
            level: 1,
            exp: 0,
            expToLevel: 100,
          },
        });
        logger.info(`👤 User data created for guild: ${userId} in ${guildId}`);
      }

      const mainEmbed = CafeEmbed.dashboard(
        interaction.user.username,
        interaction.user.displayAvatarURL(),
        {
          level: userGuild.level,
          exp: userGuild.exp,
          expToLevel: userGuild.expToLevel,
          money: userGuild.money,
          friendshipLevel: userGuild.friendshipLevel,
          friendshipExp: userGuild.friendshipExp,
          rebirth: userGuild.rebirth,
          multiplier: userGuild.moneyMultiplier,
        },
      );

      // Create buttons
      const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('menu_cafe')
            .setLabel('🍰 เมนู')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('order_food')
            .setLabel('🧾 สั่งอาหาร')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('profile')
            .setLabel('👤 โปรไฟล์')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('wallet')
            .setLabel('💰 เงินของฉัน')
            .setStyle(ButtonStyle.Secondary),
        );

      const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('daily_reward')
            .setLabel('🎁 Daily')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('quest')
            .setLabel('🎯 Quest')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('card')
            .setLabel('🎴 การ์ด')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('inventory')
            .setLabel('🎒 กระเป๋า')
            .setStyle(ButtonStyle.Danger),
        );

      const row3 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard')
            .setLabel('🏆 อันดับ')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('shop')
            .setLabel('🛒 ร้านค้า')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('rebirth')
            .setLabel('♻️ เกิดใหม่')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('help_menu')
            .setLabel('❓ ช่วยเหลือ')
            .setStyle(ButtonStyle.Secondary),
        );

      const row4 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('work_shop')
            .setLabel('🧹 ทำงาน')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('fishing')
            .setLabel('🎣 ตกปลา')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('maid_talk')
            .setLabel('💬 พูดคุย')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('mini_game')
            .setLabel('🎲 เล่นเกม')
            .setStyle(ButtonStyle.Success),
        );

      await interaction.editReply({
        embeds: [mainEmbed],
        components: [row1, row2, row3, row4],
      });

    } catch (error) {
      logger.error('Error in maid command:', error);
      await interaction.editReply({
        embeds: [CafeEmbed.error('Error', 'An error occurred. Please try again.')],
      });
    }
  },
};