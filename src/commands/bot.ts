import { CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { CommandHandler } from '../types';
import CafeEmbed from '../utils/embeds';
import prisma from '../database/prisma';

const botCommand: CommandHandler = {
  name: 'bot',
  description: 'Send a message to the configured announcement channel',
  options: [
    {
      type: 1,
      name: 'say',
      description: 'Send an announcement to the configured Maid channel',
      options: [
        { type: 3, name: 'announcement', description: 'Message to send', required: true, max_length: 2000 },
      ],
    },
  ],
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์ครับ', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'ต้องมีสิทธิ์ Manage Server เพื่อใช้คำสั่งนี้ครับ', ephemeral: true });
      return;
    }

    const settings = await prisma.guild.findUnique({ where: { id: interaction.guildId } });
    if (!settings?.maidChannelId) {
      await interaction.reply({
        embeds: [CafeEmbed.error('ยังไม่ได้ตั้งช่องประกาศ', 'ใช้ `/admin setup` ในช่องที่ต้องการให้บอตส่งประกาศก่อนครับ')],
        ephemeral: true,
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(settings.maidChannelId).catch(() => null);
    const botMember = interaction.guild.members.me;
    const permissions = channel && botMember && 'permissionsFor' in channel
      ? channel.permissionsFor(botMember)
      : null;
    if (!channel?.isTextBased() || !('send' in channel) || !permissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ])) {
      await interaction.reply({
        embeds: [CafeEmbed.error('ส่งประกาศไม่ได้', 'ตรวจสอบว่าช่องที่ตั้งไว้ยังอยู่ และบอตมีสิทธิ์ View Channel กับ Send Messages ครับ')],
        ephemeral: true,
      });
      return;
    }

    const announcement = interaction.options.getString('announcement', true);
    await channel.send({ content: announcement, allowedMentions: { parse: [] } });
    await interaction.reply({ content: `ส่งประกาศไปที่ <#${channel.id}> แล้วครับ`, ephemeral: true });
  },
};

export default botCommand;