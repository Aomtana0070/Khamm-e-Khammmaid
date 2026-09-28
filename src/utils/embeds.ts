import { EmbedBuilder, ColorResolvable } from 'discord.js';

export class CafeEmbed {
  private static PINK = '#FF69B4';
  private static ACCENT = '#FFB6C1';
  private static DEEP = '#241B3D';

  private static base(color: ColorResolvable): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(color)
      .setFooter({ text: 'Khammée Khammmaid Café  •  ใช้ /help เพื่อดูวิธีเล่น' })
      .setTimestamp();
  }

  static main(title: string, description: string): EmbedBuilder {
    return this.base(this.PINK as ColorResolvable)
      .setTitle(`🎀 ${title}`)
      .setDescription(description);
  }

  static dashboard(
    username: string,
    avatar: string | null,
    stats: { level: number; exp: number; expToLevel: number; money: number; friendshipLevel: number; friendshipExp: number; rebirth: number; multiplier: number },
  ): EmbedBuilder {
    const expProgress = this.progress(stats.exp, stats.expToLevel);
    const friendshipRequired = 100 + (stats.friendshipLevel - 1) * 50;
    const friendshipProgress = this.progress(stats.friendshipExp, friendshipRequired);

    const embed = this.base(this.DEEP as ColorResolvable)
      .setTitle('🎀 KHAMMÉE KHAMMMAID CAFÉ')
      .setDescription(`ยินดีต้อนรับกลับครับ **${username}**\nเลือกกิจกรรมจากเมนูด้านล่าง แล้วมาใช้เวลาที่คาเฟ่ด้วยกันนะครับ ☕`)
      .addFields(
        { name: '💰 กระเป๋าเงิน', value: `**${stats.money.toLocaleString()} ฿**\nตัวคูณกิจกรรม **x${stats.multiplier.toFixed(2)}**`, inline: true },
        { name: '📈 ความก้าวหน้า', value: `Lv. **${stats.level}**  •  Rebirth **${stats.rebirth}**\n${expProgress} ${stats.exp}/${stats.expToLevel} EXP`, inline: true },
        { name: '💕 ความสนิทกับ Maid', value: `Lv. **${stats.friendshipLevel}**\n${friendshipProgress} ${stats.friendshipExp}/${friendshipRequired} EXP`, inline: false },
      );

    if (avatar) {
      embed.setThumbnail(avatar);
    }

    return embed;
  }

  private static progress(current: number, total: number): string {
    const filled = Math.min(10, Math.floor((current / Math.max(total, 1)) * 10));
    return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}`;
  }

  static success(title: string, description: string): EmbedBuilder {
    return this.base('Green')
      .setTitle(`✅ ${title}`)
      .setDescription(description);
  }

  static error(title: string, description: string): EmbedBuilder {
    return this.base('Red')
      .setTitle(`❌ ${title}`)
      .setDescription(description);
  }

  static info(title: string, description: string): EmbedBuilder {
    return this.base(this.ACCENT as ColorResolvable)
      .setTitle(`ℹ️ ${title}`)
      .setDescription(description);
  }
}

export default CafeEmbed;