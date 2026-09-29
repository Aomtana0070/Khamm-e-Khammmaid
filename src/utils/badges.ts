import prisma from '../database/prisma';
import CafeEmbed from './embeds';

export const badgeCatalog = [
  { id: 'love_first', name: 'คำรักแรก', description: 'บอกรัก Maid ครั้งแรก', emoji: '💌' },
  { id: 'hug_first', name: 'อ้อมกอดแสนอุ่น', description: 'กอด Maid ครั้งแรก', emoji: '🤗' },
  { id: 'kiss_first', name: 'แก้มสีชมพู', description: 'จุ๊บแก้ม Maid ครั้งแรก', emoji: '🌸' },
  { id: 'work_first', name: 'พนักงานใหม่', description: 'ทำงานที่คาเฟ่สำเร็จ', emoji: '🧹' },
  { id: 'work_10', name: 'ดาวเด่นประจำร้าน', description: 'ทำงานสำเร็จ 10 ครั้ง', emoji: '⭐' },
  { id: 'fishing_first', name: 'นักตกปลามือใหม่', description: 'ตกปลาได้ตัวแรก', emoji: '🎣' },
  { id: 'fishing_100', name: 'ตำนานแห่งสายน้ำ', description: 'ตกปลาครบ 100 ตัว', emoji: '🏆' },
  { id: 'fish_complete_set', name: 'สารานุกรมปลา', description: 'ค้นพบปลาครบทั้ง 100 ชนิด', emoji: '📖' },
  { id: 'fishing_rare', name: 'สายตานักสะสม', description: 'ตกปลา Rare ขึ้นไป', emoji: '💎' },
  { id: 'fishing_hidden', name: 'ผู้พบสิ่งลี้ลับ', description: 'ตกพบปลาระดับลับ', emoji: '🌌', hidden: true },
  { id: 'fishing_jujutsu', name: 'คำสาปแห่งทะเล', description: 'ตกพบปลา Jujutsu Shenanigans', emoji: '🌀', hidden: true },
  { id: 'fishing_vanguards', name: 'ผู้พิชิต Vanguards', description: 'ตกพบปลา Vanguards', emoji: '👑', hidden: true },
  { id: 'fishing_god_rod', name: 'เบ็ดเทพ', description: 'อัปเกรดเบ็ดถึงระดับ 12', emoji: '⚡' },
  { id: 'bait_master', name: 'นักปรุงเหยื่อ', description: 'ทดลองใช้เหยื่อครบ 10 ชนิด', emoji: '🪱' },
  { id: 'talk_first', name: 'เพื่อนคาเฟ่', description: 'คุยกับ Maid สำเร็จ', emoji: '💬' },
  { id: 'order_first', name: 'ออเดอร์แรก', description: 'สั่งเมนูจากคาเฟ่', emoji: '🧾' },
  { id: 'order_50', name: 'ขาประจำคาเฟ่', description: 'สั่งอาหารครบ 50 รายการ', emoji: '☕' },
  { id: 'gift_first', name: 'น้ำใจชิ้นแรก', description: 'มอบของขวัญให้ Maid', emoji: '🎁' },
  { id: 'daily_first', name: 'เริ่มต้นวันดี ๆ', description: 'รับ Daily Reward ครั้งแรก', emoji: '🌅' },
  { id: 'streak_7', name: 'เจอกันเจ็ดวัน', description: 'รับ Daily Reward ต่อเนื่อง 7 วัน', emoji: '📅' },
  { id: 'quest_first', name: 'ทำตามสัญญา', description: 'ทำ Quest สำเร็จ', emoji: '🎯' },
  { id: 'minigame_win', name: 'ผู้ชนะเกมคาเฟ่', description: 'ชนะมินิเกมครั้งแรก', emoji: '🎮' },
  { id: 'ttt_win', name: 'สามเรียงสุดเก่ง', description: 'ชนะเกม XO กับบอต', emoji: '⭕' },
  { id: 'minefield_win', name: 'นักล่าสมบัติ', description: 'เคลียร์เกมหาทุ่นระเบิด', emoji: '💣' },
  { id: 'event_first', name: 'แขกคนสำคัญ', description: 'เข้าร่วม Event สำเร็จ', emoji: '🎉' },
  { id: 'card_10', name: 'นักสะสมการ์ด', description: 'สะสม Maid Card ครบ 10 ใบ', emoji: '🎴' },
  { id: 'rebirth_first', name: 'เริ่มต้นอีกครั้ง', description: 'ทำ Rebirth ครั้งแรก', emoji: '♻️' },
];

export async function unlockBadge(userGuildId: string, badgeId: string) {
  try {
    await prisma.badgeUnlock.create({ data: { userGuildId, badgeId } });
    await prisma.userGuild.update({
      where: { id: userGuildId },
      data: { achievementsCount: { increment: 1 } },
    });
    return badgeCatalog.find((badge) => badge.id === badgeId) ?? null;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return null;
    }
    throw error;
  }
}

export async function showBadges(userGuildId: string) {
  const unlocked = await prisma.badgeUnlock.findMany({ where: { userGuildId } });
  const unlockedIds = new Set(unlocked.map((badge) => badge.badgeId));
  const rows = badgeCatalog.map((badge) => {
    if (badge.hidden && !unlockedIds.has(badge.id)) {
      return '🔒 ???  •  แบดจ์ลับ';
    }
    return `${unlockedIds.has(badge.id) ? badge.emoji : '🔒'} **${badge.name}**  •  ${badge.description}`;
  });

  return CafeEmbed.main('สมุดสะสม Badges', `ปลดล็อกแล้ว **${unlocked.length}/${badgeCatalog.length}** รายการ\n\n${rows.join('\n')}`);
}