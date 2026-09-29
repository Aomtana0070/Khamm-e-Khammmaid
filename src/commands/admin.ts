import { CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { CommandHandler } from '../types';
import CafeEmbed from '../utils/embeds';
import prisma from '../database/prisma';
import { sendMaidEvent } from '../events/maidEvents';

async function writeAdminLog(guildId: string, actorId: string, action: string, details: string) {
  await prisma.adminLog.create({ data: { guildId, actorId, action, details } });
}

const adminCommand: CommandHandler = {
  name: 'admin',
  description: 'Manage the Khammée Khammmaid café',
  options: [
    {
      type: 1,
      name: 'setup',
      description: 'Set the current channel as the maid event channel',
    },
    {
      type: 1,
      name: 'give',
      description: 'Give money to a member',
      options: [
        { type: 6, name: 'user', description: 'Member to receive money', required: true },
        { type: 4, name: 'amount', description: 'Amount of money', required: true, min_value: 1, max_value: 1000000000000 },
      ],
    },
    {
      type: 1,
      name: 'level',
      description: 'Add levels to a member',
      options: [
        { type: 6, name: 'user', description: 'Member to receive levels', required: true },
        { type: 4, name: 'amount', description: 'Number of levels', required: true, min_value: 1, max_value: 100 },
      ],
    },
    {
      type: 1,
      name: 'friendship',
      description: 'Add Friendship levels with the Maid',
      options: [
        { type: 6, name: 'user', description: 'Member to receive Friendship levels', required: true },
        { type: 4, name: 'amount', description: 'Number of Friendship levels', required: true, min_value: 1, max_value: 100 },
      ],
    },
    {
      type: 1,
      name: 'cooldown',
      description: 'View or set action cooldowns; events are configured separately',
      options: [
        {
          type: 3,
          name: 'action',
          description: 'Cooldown to configure',
          required: true,
          choices: [
            { name: 'All Actions (set to 0)', value: 'all' },
            { name: 'Hug', value: 'hug' },
            { name: 'Kiss', value: 'kiss' },
            { name: 'Work', value: 'work' },
            { name: 'Fishing', value: 'fishing' },
            { name: 'Maid Talk', value: 'maid_talk' },
            { name: 'Minigame', value: 'minigame' },
            { name: 'Daily Reward', value: 'daily' },
            { name: 'Daily Quest', value: 'quest' },
            { name: 'Show all', value: 'status' },
          ],
        },
        { type: 4, name: 'minutes', description: 'Cooldown minutes (0 disables it)', required: false, min_value: 0, max_value: 10080 },
      ],
    },
    {
      type: 1,
      name: 'stats',
      description: 'Show café statistics',
    },
    {
      type: 1,
      name: 'luck',
      description: 'Configure fishing luck and temporary luck events',
      options: [
        {
          type: 3,
          name: 'action',
          description: 'Fishing luck action',
          required: true,
          choices: [
            { name: 'Status', value: 'status' },
            { name: 'Set server bonus', value: 'set' },
            { name: 'Start luck event', value: 'event_start' },
            { name: 'Stop luck event', value: 'event_stop' },
          ],
        },
        { type: 4, name: 'percent', description: 'Luck bonus percentage', required: false, min_value: 0, max_value: 50000000000000 },
        { type: 4, name: 'minutes', description: 'Luck event duration (5-1440 minutes)', required: false, min_value: 5, max_value: 144000000 },
      ],
    },
    {
      type: 1,
      name: 'event',
      description: 'Start or stop event schedule and set its interval',
      options: [
        {
          type: 3,
          name: 'action',
          description: 'Event action',
          required: true,
          choices: [
            { name: 'Send now', value: 'now' },
            { name: 'Enable schedule', value: 'start' },
            { name: 'Disable schedule', value: 'stop' },
            { name: 'Set interval (5-1440 minutes)', value: 'interval' },
            { name: 'Status', value: 'status' },
          ],
        },
        { type: 4, name: 'minutes', description: 'Interval in minutes (5-1440)', required: false, min_value: 5, max_value: 1440 },
      ],
    },
    {
      type: 1,
      name: 'logs',
      description: 'Show recent Admin actions',
    },
    {
      type: 1,
      name: 'shop',
      description: 'Open or close the café shop',
      options: [
        {
          type: 3,
          name: 'action',
          description: 'Shop state',
          required: true,
          choices: [
            { name: 'Open and announce', value: 'open' },
            { name: 'Close and announce', value: 'close' },
            { name: 'Check status', value: 'status' },
          ],
        },
      ],
    },
  ],

  async execute(interaction: CommandInteraction) {
    if (!interaction.guildId || !interaction.isChatInputCommand()) {
      await interaction.reply({ content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์ครับ', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'ต้องมีสิทธิ์ Manage Server เพื่อใช้คำสั่งนี้ครับ', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      const channel = interaction.channel;
      const botMember = interaction.guild?.members.me;
      const permissions = channel && botMember && 'permissionsFor' in channel
        ? channel.permissionsFor(botMember)
        : null;

      if (!permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ])) {
        await interaction.reply({
          embeds: [CafeEmbed.error('ตั้งค่าช่องไม่ได้', 'บอตต้องมีสิทธิ์ View Channel, Send Messages และ Embed Links ในช่องนี้ก่อนครับ')],
          ephemeral: true,
        });
        return;
      }

      await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: { maidChannelId: interaction.channelId, welcomeChannelId: interaction.channelId },
        create: {
          id: interaction.guildId,
          name: interaction.guild?.name ?? interaction.guildId,
          maidChannelId: interaction.channelId,
          welcomeChannelId: interaction.channelId,
        },
      });
      await writeAdminLog(interaction.guildId, interaction.user.id, 'setup', `channel=${interaction.channelId}`);
      await interaction.reply({
        embeds: [CafeEmbed.success('ตั้งค่าคาเฟ่สำเร็จ', `ช่องนี้จะใช้สำหรับข้อความต้อนรับและอีเว้นต์ Maid ครับ\n\nตั้งค่าโดย: <@${interaction.user.id}>`)],
      });
      return;
    }

    if (subcommand === 'give') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      const guild = await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: { name: interaction.guild?.name ?? interaction.guildId },
        create: { id: interaction.guildId, name: interaction.guild?.name ?? interaction.guildId },
      });
      void guild;
      await prisma.user.upsert({
        where: { id: target.id },
        update: { username: target.username, avatar: target.avatarURL() },
        create: { id: target.id, username: target.username, avatar: target.avatarURL() },
      });
      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId: target.id, guildId: interaction.guildId } },
        update: { money: { increment: amount } },
        create: { userId: target.id, guildId: interaction.guildId, money: 500 + amount },
      });
      await writeAdminLog(interaction.guildId, interaction.user.id, 'give', `target=${target.id} amount=${amount}`);
      await interaction.reply({
        embeds: [CafeEmbed.success('แจกเงินสำเร็จ', `มอบเงินให้ <@${target.id}> จำนวน **${amount} ฿**\nยอดคงเหลือ: **${userGuild.money} ฿**`)],
      });
      return;
    }

    if (subcommand === 'level') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: { name: interaction.guild?.name ?? interaction.guildId },
        create: { id: interaction.guildId, name: interaction.guild?.name ?? interaction.guildId },
      });
      await prisma.user.upsert({
        where: { id: target.id },
        update: { username: target.username, avatar: target.avatarURL() },
        create: { id: target.id, username: target.username, avatar: target.avatarURL() },
      });

      const current = await prisma.userGuild.findUnique({
        where: { userId_guildId: { userId: target.id, guildId: interaction.guildId } },
      });
      const currentLevel = current?.level ?? 1;
      const newLevel = currentLevel + amount;
      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId: target.id, guildId: interaction.guildId } },
        update: {
          level: newLevel,
          exp: 0,
          expToLevel: Math.round(100 * Math.pow(1.25, newLevel - 1)),
        },
        create: {
          userId: target.id,
          guildId: interaction.guildId,
          level: newLevel,
          exp: 0,
          expToLevel: Math.round(100 * Math.pow(1.25, newLevel - 1)),
        },
      });
      await writeAdminLog(interaction.guildId, interaction.user.id, 'level', `target=${target.id} amount=${amount}`);

      await interaction.reply({
        embeds: [CafeEmbed.success('เพิ่มเลเวลสำเร็จ', `เพิ่มเลเวลให้ <@${target.id}> **+${amount}**\nเลเวลปัจจุบัน: **${userGuild.level}**\nEXP ถูกรีเซ็ตเป็น 0/${userGuild.expToLevel}`)],
      });
      return;
    }

    if (subcommand === 'friendship') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: { name: interaction.guild?.name ?? interaction.guildId },
        create: { id: interaction.guildId, name: interaction.guild?.name ?? interaction.guildId },
      });
      await prisma.user.upsert({
        where: { id: target.id },
        update: { username: target.username, avatar: target.avatarURL() },
        create: { id: target.id, username: target.username, avatar: target.avatarURL() },
      });

      const current = await prisma.userGuild.findUnique({
        where: { userId_guildId: { userId: target.id, guildId: interaction.guildId } },
      });
      const friendshipLevel = (current?.friendshipLevel ?? 1) + amount;
      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId: target.id, guildId: interaction.guildId } },
        update: { friendshipLevel, friendshipExp: 0 },
        create: {
          userId: target.id,
          guildId: interaction.guildId,
          friendshipLevel,
          friendshipExp: 0,
        },
      });
      await writeAdminLog(interaction.guildId, interaction.user.id, 'friendship', `target=${target.id} amount=${amount}`);

      await interaction.reply({
        embeds: [CafeEmbed.success('เพิ่ม Friendship สำเร็จ', `เพิ่ม Friendship ให้ <@${target.id}> **+${amount}**\nFriendship ปัจจุบัน: **Lv.${userGuild.friendshipLevel}**\nEXP ถูกรีเซ็ตเป็น 0`)],
      });
      return;
    }

    if (subcommand === 'cooldown') {
      const action = interaction.options.getString('action', true);
      const guild = await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: {},
        create: {
          id: interaction.guildId,
          name: interaction.guild?.name ?? interaction.guildId,
        },
      });

      if (action === 'status') {
        await interaction.reply({
          embeds: [CafeEmbed.main('Cooldown Settings', [
            `🤗 Hug: **${guild.hugCooldownMinutes} นาที**`,
            `😘 Kiss: **${guild.kissCooldownMinutes} นาที**`,
            `🧹 Work: **${guild.workCooldownMinutes} นาที**`,
            `🎣 Fishing: **${guild.fishingCooldownMinutes} นาที**`,
            `💬 Maid Talk: **${guild.maidTalkCooldownMinutes} นาที**`,
            `🎲 Minigame: **${guild.minigameCooldownMinutes} นาที**`,
            `🎁 Daily: **${guild.dailyCooldownMinutes} นาที**`,
            `🎯 Quest: **${guild.questCooldownMinutes} นาที**`,
          ].join('\n'))],
          ephemeral: true,
        });
        return;
      }

      if (action === 'all') {
        const update = {
          hugCooldownMinutes: 0,
          kissCooldownMinutes: 0,
          workCooldownMinutes: 0,
          fishingCooldownMinutes: 0,
          maidTalkCooldownMinutes: 0,
          minigameCooldownMinutes: 0,
          dailyCooldownMinutes: 0,
          questCooldownMinutes: 0,
        };
        await prisma.guild.update({ where: { id: interaction.guildId }, data: update });
        await writeAdminLog(interaction.guildId, interaction.user.id, 'cooldown_all', 'minutes=0; events unchanged');
        await interaction.reply({
          embeds: [CafeEmbed.success('ปิด Cooldown ของ Action แล้ว', 'ตั้ง cooldown ของ Hug, Kiss, Work, Fishing, Maid Talk, Minigame, Daily และ Quest เป็น **0 นาที** แล้วครับ\n\nการตั้งค่า Event ไม่เปลี่ยนแปลง ใช้ `/admin event` แยกต่างหากได้เลย')],
        });
        return;
      }

      const minutes = interaction.options.getInteger('minutes');
      if (minutes === null) {
        await interaction.reply({ content: 'ระบุ minutes ที่ต้องการตั้ง หรือเลือก action:status เพื่อดูค่าทั้งหมดครับ', ephemeral: true });
        return;
      }

      const update = action === 'hug' ? { hugCooldownMinutes: minutes }
        : action === 'kiss' ? { kissCooldownMinutes: minutes }
          : action === 'work' ? { workCooldownMinutes: minutes }
            : action === 'fishing' ? { fishingCooldownMinutes: minutes }
              : action === 'maid_talk' ? { maidTalkCooldownMinutes: minutes }
                : action === 'minigame' ? { minigameCooldownMinutes: minutes }
                  : action === 'daily' ? { dailyCooldownMinutes: minutes }
                    : { questCooldownMinutes: minutes };

      const updatedGuild = await prisma.guild.update({ where: { id: interaction.guildId }, data: update });
      const current = action === 'hug' ? updatedGuild.hugCooldownMinutes
        : action === 'kiss' ? updatedGuild.kissCooldownMinutes
          : action === 'work' ? updatedGuild.workCooldownMinutes
            : action === 'fishing' ? updatedGuild.fishingCooldownMinutes
              : action === 'maid_talk' ? updatedGuild.maidTalkCooldownMinutes
                : action === 'minigame' ? updatedGuild.minigameCooldownMinutes
                  : action === 'daily' ? updatedGuild.dailyCooldownMinutes
                    : updatedGuild.questCooldownMinutes;
      await writeAdminLog(interaction.guildId, interaction.user.id, 'cooldown', `action=${action} minutes=${minutes}`);

      await interaction.reply({
        embeds: [CafeEmbed.success('ตั้งค่า Cooldown สำเร็จ', `**${action}** cooldown: **${current} นาที**\nใช้ 0 เพื่อปิด cooldown ได้ครับ`)],
      });
      return;
    }

    if (subcommand === 'stats') {
      const [users, totalMoney, cards] = await Promise.all([
        prisma.userGuild.count({ where: { guildId: interaction.guildId } }),
        prisma.userGuild.aggregate({ where: { guildId: interaction.guildId }, _sum: { money: true } }),
        prisma.userGuild.aggregate({ where: { guildId: interaction.guildId }, _sum: { cardsOwned: true } }),
      ]);
      await interaction.reply({
        embeds: [CafeEmbed.main('สถิติคาเฟ่', `👥 ผู้เล่น: **${users}**\n💰 เงินในระบบ: **${totalMoney._sum.money ?? 0} ฿**\n🎴 Maid Cards: **${cards._sum.cardsOwned ?? 0} ใบ**`)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'luck') {
      const action = interaction.options.getString('action', true);
      const percent = interaction.options.getInteger('percent');
      const minutes = interaction.options.getInteger('minutes');
      const guild = await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: {},
        create: { id: interaction.guildId, name: interaction.guild?.name ?? interaction.guildId },
      });

      if (action === 'status') {
        const eventActive = guild.fishingEventLuckUntil && guild.fishingEventLuckUntil > new Date();
        const eventStatus = eventActive
          ? `🟢 **+${guild.fishingEventLuckBonus}%** until <t:${Math.floor(guild.fishingEventLuckUntil!.getTime() / 1000)}:R>`
          : '⚪ ไม่มี event luck ที่กำลังทำงาน';
        await interaction.reply({
          embeds: [CafeEmbed.main('Fishing Luck', `โบนัสโชคประจำเซิร์ฟเวอร์: **+${guild.fishingLuckBonus}%**\nFishing Luck Event: ${eventStatus}`)],
          ephemeral: true,
        });
        return;
      }

      if (action === 'set') {
        if (percent === null) {
          await interaction.reply({ content: 'ระบุ percent ตั้งแต่ 0 ถึง 500 ครับ', ephemeral: true });
          return;
        }
        await prisma.guild.update({ where: { id: interaction.guildId }, data: { fishingLuckBonus: percent } });
        await writeAdminLog(interaction.guildId, interaction.user.id, 'fishing_luck_set', `percent=${percent}`);
        await interaction.reply({ embeds: [CafeEmbed.success('ตั้ง Fishing Luck แล้ว', `โบนัสโชคประจำเซิร์ฟเวอร์: **+${percent}%**`)] });
        return;
      }

      if (action === 'event_start') {
        if (percent === null || percent < 1 || minutes === null) {
          await interaction.reply({ content: 'ระบุ percent ตั้งแต่ 1 ถึง 500 และ minutes ตั้งแต่ 5 ถึง 1440 ครับ', ephemeral: true });
          return;
        }
        const until = new Date(Date.now() + minutes * 60_000);
        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { fishingEventLuckBonus: percent, fishingEventLuckUntil: until },
        });
        await writeAdminLog(interaction.guildId, interaction.user.id, 'fishing_luck_event_start', `percent=${percent} minutes=${minutes}`);

        let announced = false;
        const announcementChannel = guild.maidChannelId
          ? await interaction.guild?.channels.fetch(guild.maidChannelId).catch(() => null)
          : null;
        if (announcementChannel?.isTextBased() && 'send' in announcementChannel) {
          await announcementChannel.send({
            embeds: [CafeEmbed.success('🎣 Fishing Luck Event!', `โชคตกปลาเพิ่ม **+${percent}%** เป็นเวลา **${minutes} นาที** รีบมาใช้เบ็ดกับเหยื่อแล้วลุ้นปลาหายากกันครับ!`)],
          }).then(() => { announced = true; }).catch(() => undefined);
        }
        await interaction.reply({
          embeds: [CafeEmbed.success('เริ่ม Fishing Luck Event แล้ว', `โบนัส **+${percent}%** หมดเวลา <t:${Math.floor(until.getTime() / 1000)}:R>${announced ? '\nประกาศในช่อง Maid แล้วครับ' : '\nยังประกาศไม่ได้ ตรวจสอบช่องด้วย `/admin setup` ครับ'}`)],
          ephemeral: true,
        });
        return;
      }

      if (action === 'event_stop') {
        await prisma.guild.update({
          where: { id: interaction.guildId },
          data: { fishingEventLuckBonus: 0, fishingEventLuckUntil: null },
        });
        await writeAdminLog(interaction.guildId, interaction.user.id, 'fishing_luck_event_stop', '');
        let announced = false;
        const announcementChannel = guild.maidChannelId
          ? await interaction.guild?.channels.fetch(guild.maidChannelId).catch(() => null)
          : null;
        if (announcementChannel?.isTextBased() && 'send' in announcementChannel) {
          await announcementChannel.send({
            embeds: [CafeEmbed.info('Fishing Luck Event จบแล้ว', 'กิจกรรมโบนัสโชคตกปลาจบลงแล้วครับ ขอบคุณทุกคนที่มาร่วมลุ้นปลา!')],
          }).then(() => { announced = true; }).catch(() => undefined);
        }
        await interaction.reply({ embeds: [CafeEmbed.info('ปิด Fishing Luck Event แล้ว', `โบนัสโชคจาก event ถูกปิดแล้วครับ${announced ? ' ประกาศในช่อง Maid แล้ว' : ''}`)], ephemeral: true });
      }
    }

    if (subcommand === 'event') {
      const action = interaction.options.getString('action', true);
      const minutes = interaction.options.getInteger('minutes');
      const guildId = interaction.guildId;
      const existing = await prisma.guild.upsert({
        where: { id: guildId },
        update: { name: interaction.guild?.name ?? guildId },
        create: { id: guildId, name: interaction.guild?.name ?? guildId, maidChannelId: interaction.channelId },
      });

      if (action === 'now') {
        const sent = await sendMaidEvent(interaction.client, guildId, true);
        await writeAdminLog(guildId, interaction.user.id, 'event_now', `sent=${sent}`);
        await interaction.reply({
          embeds: [sent
            ? CafeEmbed.success('ส่ง Event แล้ว', 'ส่ง Event ไปยังช่อง Maid เรียบร้อยครับ 🎉')
            : CafeEmbed.error('ส่ง Event ไม่สำเร็จ', 'ยังไม่ได้ตั้งช่อง Event ใช้ `/admin setup` ก่อนครับ')],
        });
        return;
      }

      if (action === 'start' || action === 'stop') {
        if (action === 'start' && !existing.maidChannelId) {
          await interaction.reply({ embeds: [CafeEmbed.error('ยังไม่ได้ตั้งช่อง Event', 'ใช้ `/admin setup` ในช่องที่ต้องการให้บอตส่ง Event ก่อนครับ')], ephemeral: true });
          return;
        }
        await prisma.guild.update({
          where: { id: guildId },
          data: {
            eventEnabled: action === 'start',
            nextEventAt: action === 'start' ? new Date() : null,
          },
        });
        await writeAdminLog(guildId, interaction.user.id, `event_${action}`, '');
        await interaction.reply({
          embeds: [CafeEmbed.success('อัปเดต Event แล้ว', action === 'start' ? 'เปิดตาราง Event แล้ว รอบถัดไปจะเริ่มภายในประมาณ 1 นาทีครับ' : 'ปิดตาราง Event อัตโนมัติแล้วครับ')],
        });
        return;
      }

      if (action === 'interval') {
        if (!minutes) {
          await interaction.reply({ content: 'กรุณาระบุ minutes ระหว่าง 5 ถึง 1440 ครับ', ephemeral: true });
          return;
        }
        await prisma.guild.update({
          where: { id: guildId },
          data: {
            eventIntervalMinutes: minutes,
            nextEventAt: existing.eventEnabled ? new Date(Date.now() + minutes * 60_000) : null,
          },
        });
        await writeAdminLog(guildId, interaction.user.id, 'event_interval', `minutes=${minutes}`);
        await interaction.reply({
          embeds: [CafeEmbed.success('ตั้งช่วง Event แล้ว', `บันทึกช่วงเวลา **${minutes} นาที** แล้วครับ${existing.eventEnabled ? ' Event ถัดไปจะเริ่มหลังช่วงเวลานี้' : ' ตาราง Event ยังปิดอยู่ เปิดได้ด้วย `/admin event action:Enable schedule`'}`)],
        });
        return;
      }

      if (action === 'status') {
        const next = !existing.eventEnabled ? 'ปิดอยู่' : existing.nextEventAt ? `<t:${Math.floor(existing.nextEventAt.getTime() / 1000)}:R>` : 'กำลังรอกำหนด';
        const last = existing.lastEventAt ? `<t:${Math.floor(existing.lastEventAt.getTime() / 1000)}:R>` : 'ยังไม่มี';
        const [participants, recent] = await Promise.all([
          prisma.eventParticipation.count({ where: { guildId } }),
          prisma.eventParticipation.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 5 }),
        ]);
        await interaction.reply({
          embeds: [CafeEmbed.main('Event Dashboard', `สถานะ: **${existing.eventEnabled ? 'เปิด' : 'ปิด'}**\nช่วงเวลา: **${existing.eventIntervalMinutes} นาที**\nEvent ถัดไป: ${next}\nEvent ล่าสุด: ${last}\nผู้เข้าร่วมสะสม: **${participants}**\n\nผู้เข้าร่วมล่าสุด: **${recent.length} คน**`)],
          ephemeral: true,
        });
        return;
      }

      void existing;
    }

    if (subcommand === 'logs') {
      const logs = await prisma.adminLog.findMany({ where: { guildId: interaction.guildId }, orderBy: { createdAt: 'desc' }, take: 10 });
      const description = logs.length
        ? logs.map((log) => `• <t:${Math.floor(log.createdAt.getTime() / 1000)}:R> **${log.action}** <@${log.actorId}> ${log.details}`).join('\n')
        : 'ยังไม่มีประวัติ Admin ครับ';
      await interaction.reply({ embeds: [CafeEmbed.main('Admin Log', description)], ephemeral: true });
      return;
    }

    if (subcommand === 'shop') {
      const action = interaction.options.getString('action', true);
      const shopOpen = action === 'open' ? true : action === 'close' ? false : undefined;
      const guild = await prisma.guild.upsert({
        where: { id: interaction.guildId },
        update: shopOpen === undefined ? {} : { shopOpen },
        create: {
          id: interaction.guildId,
          name: interaction.guild?.name ?? interaction.guildId,
          ...(shopOpen === undefined ? {} : { shopOpen }),
        },
      });

      if (shopOpen === undefined) {
        await interaction.reply({
          embeds: [CafeEmbed.info('สถานะร้าน', guild.shopOpen ? '🟢 ร้านเปิดให้บริการครับ' : '🔴 ร้านปิดอยู่ครับ')],
          ephemeral: true,
        });
        return;
      }

      const announcementChannelId = guild.maidChannelId ?? interaction.channelId;
      const announcementChannel = await interaction.guild?.channels.fetch(announcementChannelId).catch(() => null);
      let announced = false;
      const botMember = interaction.guild?.members.me;
      const channelPermissions = announcementChannel && botMember && 'permissionsFor' in announcementChannel
        ? announcementChannel.permissionsFor(botMember)
        : null;
      if (announcementChannel?.isTextBased() && 'send' in announcementChannel && channelPermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ])) {
        try {
          await announcementChannel.send({
            embeds: [shopOpen
              ? CafeEmbed.success('คาเฟ่เปิดแล้ว!', '🎀 ร้านเปิดให้บริการแล้วครับ แวะมาซื้อขนม เครื่องดื่ม และอาหาร หรือมาเล่นกิจกรรมกับ Maid กันนะครับ ☕')
              : CafeEmbed.info('คาเฟ่ปิดแล้ว', '🌙 วันนี้ร้านปิดให้บริการแล้วครับ ขอบคุณที่แวะมาหากัน แล้วพบกันใหม่รอบหน้านะครับ 💕')],
          });
          announced = true;
        } catch {
          announced = false;
        }
      }

      await writeAdminLog(interaction.guildId, interaction.user.id, `shop_${action}`, `announced=${announced}`);
      await interaction.reply({
        embeds: [CafeEmbed.success(shopOpen ? 'เปิดร้านแล้ว' : 'ปิดร้านแล้ว', announced
          ? `อัปเดตสถานะร้านและประกาศใน <#${announcementChannelId}> แล้วครับ`
          : 'อัปเดตสถานะร้านแล้ว แต่ส่งประกาศไม่สำเร็จ ตรวจสอบช่องและสิทธิ์บอตครับ')],
        ephemeral: true,
      });
    }
  },
};

export default adminCommand;
