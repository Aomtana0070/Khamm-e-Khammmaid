import { AttachmentBuilder, CommandInteraction } from 'discord.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CommandHandler } from '../../types';
import CafeEmbed from '../../utils/embeds';
import prisma from '../../database/prisma';
import { unlockBadge } from '../../utils/badges';

async function getUserGuild(interaction: CommandInteraction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    throw new Error('This command can only be used in a server.');
  }

  const guildName = interaction.guild?.name ?? guildId;
  await prisma.guild.upsert({
    where: { id: guildId },
    update: { name: guildName },
    create: { id: guildId, name: guildName },
  });
  await prisma.user.upsert({
    where: { id: interaction.user.id },
    update: { username: interaction.user.username, avatar: interaction.user.avatarURL() },
    create: { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.avatarURL() },
  });

  return prisma.userGuild.upsert({
    where: { userId_guildId: { userId: interaction.user.id, guildId } },
    update: {},
    create: { userId: interaction.user.id, guildId },
  });
}

async function useAffection(
  interaction: CommandInteraction,
  type: 'hug' | 'kiss' | 'love',
  minimumLevel: number,
  friendshipGain: number,
  message: string,
) {
  const userGuild = await getUserGuild(interaction);

  if (userGuild.friendshipLevel < minimumLevel) {
    await interaction.reply({
      embeds: [CafeEmbed.info('ยังไม่ถึงระดับความสนิท', `ฟีเจอร์นี้ต้อง Friendship Lv.${minimumLevel}\nระดับปัจจุบัน: Lv.${userGuild.friendshipLevel}`)],
      ephemeral: true,
    });
    return;
  }

  const guildSettings = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  const cooldownMinutes = type === 'kiss'
    ? guildSettings?.kissCooldownMinutes ?? 120
    : guildSettings?.hugCooldownMinutes ?? 30;
  const cooldownType = `${interaction.guildId}_affection_${type}`;

  if (cooldownMinutes > 0) {
    const now = new Date();
    const cooldown = await prisma.cooldown.findUnique({
      where: { userId_type: { userId: interaction.user.id, type: cooldownType } },
    });

    if (cooldown && cooldown.expiresAt > now) {
      const minutes = Math.ceil((cooldown.expiresAt.getTime() - now.getTime()) / 60_000);
      await interaction.reply({
        embeds: [CafeEmbed.info('Maid ขอพักก่อนนะครับ', `ลองใหม่ได้ในอีก ${minutes} นาทีครับ 💕`)],
        ephemeral: true,
      });
      return;
    }

    const expiresAt = new Date(now.getTime() + cooldownMinutes * 60_000);
    await prisma.cooldown.upsert({
      where: { userId_type: { userId: interaction.user.id, type: cooldownType } },
      update: { expiresAt },
      create: { userId: interaction.user.id, type: cooldownType, expiresAt },
    });
  }

  let friendshipLevel = userGuild.friendshipLevel;
  let friendshipExp = userGuild.friendshipExp + friendshipGain;
  let requiredExp = 100 + (friendshipLevel - 1) * 50;
  while (friendshipExp >= requiredExp) {
    friendshipExp -= requiredExp;
    friendshipLevel += 1;
    requiredExp = 100 + (friendshipLevel - 1) * 50;
  }

  await prisma.userGuild.update({
    where: { id: userGuild.id },
    data: { friendshipLevel, friendshipExp },
  });
  await unlockBadge(userGuild.id, `${type}_first`);

  const affection = {
    hug: { imageName: '1.png', title: 'กอด Maid' },
    kiss: { imageName: '2.png', title: 'จุ๊บแก้ม Maid' },
    love: { imageName: '3.png', title: 'บอกรัก Maid' },
  }[type];
  const imageName = affection.imageName;
  const imagePath = path.join(process.cwd(), 'assets', 'affection', imageName);
  const embed = CafeEmbed.main(
    affection.title,
    `${message}\n\nได้รับ Friendship EXP **+${friendshipGain}** 💕`,
  );
  const files = existsSync(imagePath)
    ? [new AttachmentBuilder(imagePath, { name: imageName })]
    : [];

  if (files.length) {
    embed.setImage(`attachment://${imageName}`);
  }

  await interaction.reply({ embeds: [embed], files });
}

export const hugCommand: CommandHandler = {
  name: 'hug',
  description: 'กอด Maid เมื่อสนิทถึงระดับที่กำหนด',
  async execute(interaction: CommandInteraction) {
    await useAffection(interaction, 'hug', 2, 12, 'Maid รีบโผเข้ากอดคุณแน่น ๆ ซุกหน้ากับไหล่แล้วกระซิบว่า “รักคุณที่สุดเลยนะครับ ขอบคุณที่เข้ามาเป็นความสุขของ Maid ทุกวัน ขอให้กอดนี้อยู่กับคุณไปนาน ๆ เลย” 🤗💕');
  },
};

export const kissCommand: CommandHandler = {
  name: 'kiss',
  description: 'จุ๊บแก้ม Maid เมื่อสนิทถึงระดับที่กำหนด',
  async execute(interaction: CommandInteraction) {
    await useAffection(interaction, 'kiss', 5, 25, 'Maid หน้าแดงจนยิ้มไม่หุบ ก่อนจะจุ๊บแก้มคุณเบา ๆ แล้วบอกว่า “รักคุณนะครับ คนเก่งของ Maid วันนี้ก็น่ารักที่สุดเลย ถ้าโลกใจร้ายกับคุณเมื่อไร กลับมาหา Maid ได้เสมอนะครับ” 🌸💗');
  },
};

export const loveCommand: CommandHandler = {
  name: 'love',
  description: 'บอกรัก Maid แสนหวาน',
  async execute(interaction: CommandInteraction) {
    await useAffection(interaction, 'love', 1, 15, 'Maid ได้ยินแล้วก็ยิ้มจนตาเป็นประกาย ก่อนจะจับมือคุณไว้แล้วบอกว่า “Maid ก็รักคุณที่สุดเลยนะครับ ขอบคุณที่เลือกแวะมาหากันเสมอ ไม่ว่าวันนี้จะเหนื่อยหรือยิ้มได้ ขอให้รู้ไว้ว่าคุณเป็นคนพิเศษของ Maid มาก ๆ เลยนะ” 💗🌷');
  },
};
