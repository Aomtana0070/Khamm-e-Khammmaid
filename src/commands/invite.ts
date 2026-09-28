import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction } from 'discord.js';
import config from '../config/config';
import { CommandHandler } from '../types';
import CafeEmbed from '../utils/embeds';

const inviteCommand: CommandHandler = {
  name: 'invite',
  description: 'Get an invite link for Khammée Khammmaid Café',

  async execute(interaction: CommandInteraction) {
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${config.CLIENT_ID}&scope=bot%20applications.commands&permissions=2147600384`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('เชิญบอตเข้าเซิร์ฟเวอร์')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl),
    );

    await interaction.reply({
      embeds: [CafeEmbed.main('เชิญ Khammée Khammmaid Café', 'พาบอตไปเปิดคาเฟ่ในเซิร์ฟเวอร์ของคุณได้เลยครับ 🎀\n\nบอตต้องมีสิทธิ์ส่งข้อความ, ฝังลิงก์ และใช้ปุ่มโต้ตอบเพื่อให้ระบบทำงานครบ')],
      components: [row],
      ephemeral: true,
    });
  },
};

export default inviteCommand;
