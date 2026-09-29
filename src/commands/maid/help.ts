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
        { name: '🎮 กิจกรรม', value: '🎣 ตกปลา • อัปเกรดเบ็ด • สะสมปลา 100 ชนิด\n🎲 XO • หาทุ่นระเบิด • เป่ายิ้งฉุบ • 🎯 Quest\n🏅 Badges และ 🎴 Maid Card', inline: false },
        { name: '💕 ความสัมพันธ์', value: '💬 พูดคุยกับ Maid เพื่อเพิ่ม Friendship\n/love ใช้ได้เมื่อ Lv.1  •  /hug ใช้ได้เมื่อ Lv.2  •  /kiss ใช้ได้เมื่อ Lv.5', inline: false },
        { name: '📚 ข้อมูลผู้เล่น', value: '👤 โปรไฟล์  •  🎒 กระเป๋า  •  🏆 อันดับ  •  ♻️ เกิดใหม่', inline: false },
      );

    await interaction.editReply({
      embeds: [helpEmbed],
    });
  },
};