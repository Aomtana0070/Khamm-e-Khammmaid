import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../database/prisma';
import CafeEmbed from '../utils/embeds';
import logger from '../utils/logger';

export const maidEvents = [
  { id: 'cafe_rush', title: 'คาเฟ่คึกคัก', message: 'คิดถึงทุกคนจังครับ ☕ ถ้าว่างแวะมาช่วยรับออเดอร์กับ Maid สักรอบนะครับ มีรางวัลรออยู่!', reward: 150, exp: 20 },
  { id: 'fishing_hour', title: 'ชั่วโมงตกปลา', message: 'Maid เตรียมเบ็ดไว้ให้แล้วครับ 🎣 แวะมาพักใจ ตกปลาเล่นด้วยกันสักหน่อยไหมครับ?', reward: 180, exp: 25 },
  { id: 'talk_table', title: 'โต๊ะพูดคุย', message: 'โต๊ะประจำของทุกคนยังว่างอยู่นะครับ 💬 แวะมาทักทายและเล่าเรื่องวันนี้ให้ Maid ฟังหน่อยได้ไหม?', reward: 120, exp: 30 },
  { id: 'card_hunt', title: 'ตามล่าการ์ด', message: 'Maid ซ่อนการ์ดพิเศษไว้ในคาเฟ่แล้วครับ 🎴 มาช่วยกันหาไหมครับ คนที่เข้าร่วมรับรางวัลได้เลย!', reward: 100, exp: 15 },
];

export async function handleMemberJoin(member: GuildMember) {
  const guildSettings = await prisma.guild.findUnique({ where: { id: member.guild.id } });
  const channelId = guildSettings?.welcomeChannelId ?? guildSettings?.maidChannelId;

  if (!channelId) {
    return;
  }

  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    return;
  }

  await channel.send({
    embeds: [CafeEmbed.main('ยินดีต้อนรับสู่คาเฟ่', `ยินดีต้อนรับ <@${member.id}> เข้าสู่เซิร์ฟเวอร์ครับ 🎀\n\nกด \/maid เพื่อเริ่มเล่น ทำงาน ตกปลา ซื้อของ และคุยกับ Maid ได้เลย!`)],
  });
}

export async function sendMaidEvent(client: Client, guildId: string, force = false) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return false;
  }

  const settings = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!settings?.maidChannelId || (!settings.eventEnabled && !force)) {
    return false;
  }

  const event = maidEvents[Math.floor(Math.random() * maidEvents.length)];
  const channel = await guild.channels.fetch(settings.maidChannelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) {
    await scheduleNextAttempt(guildId, settings.eventIntervalMinutes);
    return false;
  }

  if (!('permissionsFor' in channel) || !client.user) {
    await scheduleNextAttempt(guildId, settings.eventIntervalMinutes);
    return false;
  }

  const permissions = channel.permissionsFor(client.user);
  if (!permissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ])) {
    logger.warn(`Maid event skipped in guild ${guildId}: bot lacks channel permissions`);
    await scheduleNextAttempt(guildId, settings.eventIntervalMinutes);
    return false;
  }

  const nextEventAt = new Date(Date.now() + settings.eventIntervalMinutes * 60_000);
  const eventInstance = Date.now().toString();
  try {
    await channel.send({
      embeds: [CafeEmbed.main(`Event • ${event.title}`, `${event.message}\n\n💰 รางวัลเข้าร่วม **${event.reward} ฿**\n⭐ EXP **${event.exp}**\n\nกดปุ่มด้านล่างเพื่อเข้าร่วมได้เลยครับ`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`maid_event_join:${event.id}:${eventInstance}`).setLabel('🎉 เข้าร่วม Event').setStyle(ButtonStyle.Success),
      )],
    });
  } catch (error) {
    logger.warn(`Maid event skipped in guild ${guildId}: unable to send to configured channel`);
    await scheduleNextAttempt(guildId, settings.eventIntervalMinutes);
    return false;
  }

  await prisma.guild.update({
    where: { id: guildId },
    data: { lastEventAt: new Date(), nextEventAt },
  });
  return true;
}

async function scheduleNextAttempt(guildId: string, intervalMinutes: number) {
  await prisma.guild.update({
    where: { id: guildId },
    data: { nextEventAt: new Date(Date.now() + intervalMinutes * 60_000) },
  }).catch((error) => logger.error('Could not schedule next Maid event:', error));
}

export function startMaidEvents(client: Client) {
  client.on('guildMemberAdd', (member) => {
    handleMemberJoin(member).catch((error) => logger.error('Welcome event failed:', error));
  });

  const checkEvents = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const settings = await prisma.guild.findUnique({ where: { id: guild.id } });
        if (!settings?.maidChannelId || !settings.eventEnabled) {
          continue;
        }

        const due = !settings.nextEventAt || settings.nextEventAt <= new Date();
        if (due) {
          await sendMaidEvent(client, guild.id);
        }
      } catch (error) {
        logger.error('Maid event failed:', error);
      }
    }
  };

  client.once('ready', () => { void checkEvents(); });
  setInterval(() => { void checkEvents(); }, 60_000);
}
