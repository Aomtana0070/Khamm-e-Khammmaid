import { CommandInteraction } from 'discord.js';
import { CommandHandler } from '../../types';
import CafeEmbed from '../../utils/embeds';

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show help information',
  
  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    const helpEmbed = CafeEmbed.main('ความช่วยเหลือ', 'เปิด `/maid` เพื่อกลับไปยังหน้าเมนูหลัก แล้วเลือกกิจกรรมที่ต้องการได้เลยครับ ✨')
      .addFields(
        { name: '💰 คาเฟ่และเศรษฐกิจ', value: '🍰 เมนู  •  🧾 สั่งอาหาร  •  🛒 ร้านค้า\n🎁 Daily  •  🧹 ทำงาน  •  💰 เงินของฉัน', inline: false },
        { name: '🎮 กิจกรรม', value: '🎣 ตกปลา  •  🎲 มินิเกม  •  🎯 Quest\n🎴 Card Pack และการสะสม Maid Card', inline: false },
        { name: '💕 ความสัมพันธ์', value: '💬 พูดคุยกับ Maid เพื่อเพิ่ม Friendship\n/hug ใช้ได้เมื่อ Lv.2  •  /kiss ใช้ได้เมื่อ Lv.5', inline: false },
        { name: '📚 ข้อมูลผู้เล่น', value: '👤 โปรไฟล์  •  🎒 กระเป๋า  •  🏆 อันดับ  •  ♻️ เกิดใหม่', inline: false },
      );

    await interaction.editReply({
      embeds: [helpEmbed],
    });
  },
};