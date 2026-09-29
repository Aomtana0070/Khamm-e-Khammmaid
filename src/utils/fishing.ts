import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import prisma from '../database/prisma';
import CafeEmbed from './embeds';
import { unlockBadge } from './badges';

const rarityTiers = [
  { id: 'common', name: 'ง่ายมาก', weight: 600, multiplier: 1, emoji: '⚪' },
  { id: 'uncommon', name: 'ง่าย', weight: 240, multiplier: 1.5, emoji: '🟢' },
  { id: 'rare', name: 'ไม่ธรรมดา', weight: 100, multiplier: 3, emoji: '🔵' },
  { id: 'epic', name: 'หายาก', weight: 45, multiplier: 6, emoji: '🟣' },
  { id: 'legendary', name: 'ตำนาน', weight: 18, multiplier: 12, emoji: '🟠' },
  { id: 'mythic', name: 'มายา', weight: 8, multiplier: 25, emoji: '🔴' },
  { id: 'celestial', name: 'สวรรค์', weight: 3.5, multiplier: 60, emoji: '🌟' },
  { id: 'secret', name: 'ลับ', weight: 1, multiplier: 150, emoji: '🌌' },
  { id: 'jujutsu', name: 'Jujutsu Shenanigans', weight: 0.18, multiplier: 500, emoji: '🌀' },
  { id: 'vanguards', name: 'Vanguards', weight: 0.025, multiplier: 1500, emoji: '👑' },
];

const fishPrefixes = ['จิ๋ว', 'สายธาร', 'เงิน', 'ตะวัน', 'จันทรา', 'คริสตัล', 'พายุ', 'โบราณ', 'ภูต', 'สวรรค์'];
const fishSpecies = ['ปลาคาร์ป', 'ปลาเทราต์', 'ปลาคราฟ', 'ปลาดุก', 'ปลากัด', 'ปลากระเบน', 'ปลาหมึก', 'ปลาปักเป้า', 'ปลามังกร', 'ปลาวาฬ'];

export const fishCatalog = rarityTiers.flatMap((tier, tierIndex) => fishPrefixes.map((prefix, fishIndex) => ({
  id: `fish_${tier.id}_${fishIndex + 1}`,
  name: `${prefix}${fishSpecies[fishIndex]}`,
  rarity: tier.name,
  rarityId: tier.id,
  rarityIndex: tierIndex,
  emoji: tierIndex >= 7 ? '🐉' : ['🐟', '🐠', '🦑', '🐡', '🦈'][fishIndex % 5],
  weight: tier.weight,
  reward: Math.round((20 + fishIndex * 4) * tier.multiplier),
  rarityEmoji: tier.emoji,
})));

export const fishingRods = [
  { name: 'เบ็ดไม้ไผ่', cost: 0, accuracy: 0, luck: 0 },
  { name: 'เบ็ดฝึกหัด', cost: 500, accuracy: 0, luck: 20 },
  { name: 'เบ็ดไฟเบอร์', cost: 1200, accuracy: 1, luck: 50 },
  { name: 'เบ็ดคาร์บอน', cost: 2600, accuracy: 1, luck: 90 },
  { name: 'เบ็ดเงิน', cost: 5000, accuracy: 1, luck: 140 },
  { name: 'เบ็ดทอง', cost: 9500, accuracy: 2, luck: 200 },
  { name: 'เบ็ดทะเลลึก', cost: 18000, accuracy: 2, luck: 270 },
  { name: 'เบ็ดคริสตัล', cost: 35000, accuracy: 2, luck: 350 },
  { name: 'เบ็ดมังกร', cost: 70000, accuracy: 3, luck: 450 },
  { name: 'เบ็ดดารา', cost: 140000, accuracy: 3, luck: 580 },
  { name: 'เบ็ดห้วงอเวจี', cost: 280000, accuracy: 4, luck: 740 },
  { name: 'เบ็ดเทพ', cost: 600000, accuracy: 4, luck: 950 },
];

export const fishingBaits = [
  { id: 'worm', name: 'ไส้เดือน', price: 30, luck: 30, emoji: '🪱' },
  { id: 'bread', name: 'ขนมปัง', price: 50, luck: 50, emoji: '🍞' },
  { id: 'shrimp', name: 'กุ้งสด', price: 100, luck: 80, emoji: '🦐' },
  { id: 'glow_worm', name: 'หนอนเรืองแสง', price: 180, luck: 120, emoji: '✨' },
  { id: 'sweet_corn', name: 'ข้าวโพดหวาน', price: 280, luck: 160, emoji: '🌽' },
  { id: 'golden_lure', name: 'เหยื่อทอง', price: 500, luck: 220, emoji: '🪙' },
  { id: 'moon_jelly', name: 'วุ้นจันทรา', price: 900, luck: 300, emoji: '🌙' },
  { id: 'dragon_scale', name: 'เกล็ดมังกร', price: 1600, luck: 400, emoji: '🐉' },
  { id: 'star_dust', name: 'ผงดวงดาว', price: 3000, luck: 550, emoji: '🌠' },
  { id: 'void_lure', name: 'เหยื่อห้วงมิติ', price: 6000, luck: 750, emoji: '🌀' },
];

type FishingState = {
  position: number;
  target: number;
  progress: number;
  misses: number;
  expiresAt: number;
  baitLuck: number;
  baitId: string;
  storedValue?: string;
};

async function getProfile(userGuildId: string) {
  return prisma.fishingProfile.upsert({
    where: { userGuildId },
    update: {},
    create: { userGuildId },
  });
}

async function getUserGuildId(interaction: ButtonInteraction) {
  if (!interaction.guildId) {
    throw new Error('Fishing can only be used in a server.');
  }
  const userGuild = await prisma.userGuild.findUnique({
    where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guildId } },
  });
  if (!userGuild) {
    throw new Error('Use /maid before fishing.');
  }
  return userGuild.id;
}

function row(...buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

function actionButton(id: string, label: string, style = ButtonStyle.Primary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
}

async function fishingHub(userGuildId: string) {
  const [profile, inventory, userGuild] = await Promise.all([
    getProfile(userGuildId),
    prisma.inventory.findMany({ where: { userGuildId, itemType: 'bait' }, orderBy: { createdAt: 'asc' } }),
    prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } }),
  ]);
  const guildSettings = await prisma.guild.findUnique({ where: { id: userGuild.guildId } });
  const eventLuck = guildSettings?.fishingEventLuckUntil && guildSettings.fishingEventLuckUntil > new Date()
    ? guildSettings.fishingEventLuckBonus
    : 0;
  const rod = fishingRods[profile.rodLevel - 1];
  const nextRod = fishingRods[profile.rodLevel];
  const equipped = fishingBaits.find((bait) => bait.id === profile.equippedBait);
  const baits = inventory.length
    ? inventory.map((item) => {
      const bait = fishingBaits.find((entry) => entry.id === item.itemId);
      return bait ? `${bait.emoji} ${bait.name} x${item.quantity}${profile.equippedBait === bait.id ? ' (เลือกใช้อยู่)' : ''}` : null;
    }).filter(Boolean).join('\n')
    : 'ยังไม่มีเหยื่อ ลองซื้อจากร้านเหยื่อด้านล่างครับ';
  const embed = CafeEmbed.main('🎣 Fishing Dock', [
    `เบ็ดระดับ **${profile.rodLevel}/12 • ${rod.name}** | โชคเบ็ด +${rod.luck}%`,
    `ปลาที่ตกได้ **${profile.totalCatches}/100** | เหยื่อ: **${equipped?.name ?? 'ไม่มี'}**`,
    `Fishing Luck: เซิร์ฟเวอร์ +${guildSettings?.fishingLuckBonus ?? 0}%${eventLuck ? ` • Event +${eventLuck}%` : ''}`,
    `เงิน **${userGuild.money.toLocaleString()} ฿**`,
    '',
    `**เหยื่อในกระเป๋า**\n${baits}`,
    '',
    'ขยับแถบคุมให้ตรงกับแนวปลา แล้วกดรีลให้ progress เต็มก่อนปลาหนี',
  ].join('\n'));
  const components = [row(
    actionButton('fish_start', '🎣 เริ่มตกปลา', ButtonStyle.Success),
    actionButton('fish_upgrade', nextRod ? `⬆️ อัปเบ็ด ${nextRod.cost.toLocaleString()} ฿` : '✨ เบ็ดเทพสูงสุด', ButtonStyle.Primary).setDisabled(!nextRod),
  ), row(
    actionButton('fish_bait_shop', '🛒 ร้านเหยื่อ'),
    actionButton('fish_bait_equip', '🪱 เลือกเหยื่อ'),
    actionButton('fish_collection:0', '📖 สมุดปลา', ButtonStyle.Secondary),
    actionButton('badge_book', '🏅 Badges', ButtonStyle.Secondary),
  )];
  return { embeds: [embed], components };
}

async function saveFishingState(interaction: ButtonInteraction, value: FishingState | null) {
  const key = `fish_active_${interaction.guildId}`;
  if (!value) {
    await prisma.memory.deleteMany({ where: { userId: interaction.user.id, key } });
    return;
  }
  const { storedValue: _storedValue, ...state } = value;
  const serialized = JSON.stringify(state);
  await prisma.memory.upsert({
    where: { userId_key: { userId: interaction.user.id, key } },
    update: { value: serialized },
    create: { userId: interaction.user.id, key, value: serialized },
  });
}

async function readFishingState(interaction: ButtonInteraction) {
  const key = `fish_active_${interaction.guildId}`;
  const memory = await prisma.memory.findUnique({ where: { userId_key: { userId: interaction.user.id, key } } });
  if (!memory) return null;
  const state = JSON.parse(memory.value) as FishingState;
  return state.expiresAt > Date.now() ? { ...state, storedValue: memory.value } : null;
}

async function replaceFishingState(interaction: ButtonInteraction, current: FishingState, next: FishingState) {
  const key = `fish_active_${interaction.guildId}`;
  const { storedValue: _storedValue, ...state } = next;
  const result = await prisma.memory.updateMany({
    where: { userId: interaction.user.id, key, value: current.storedValue },
    data: { value: JSON.stringify(state) },
  });
  return result.count === 1;
}

async function consumeFishingState(interaction: ButtonInteraction, state: FishingState) {
  const result = await prisma.memory.deleteMany({
    where: { userId: interaction.user.id, key: `fish_active_${interaction.guildId}`, value: state.storedValue },
  });
  return result.count === 1;
}

async function recordBaitUse(interaction: ButtonInteraction, baitId: string) {
  const key = `fishing_baits_used_${interaction.guildId}`;
  const memory = await prisma.memory.findUnique({ where: { userId_key: { userId: interaction.user.id, key } } });
  const usedBaits = new Set<string>(memory ? JSON.parse(memory.value) as string[] : []);
  usedBaits.add(baitId);
  await prisma.memory.upsert({
    where: { userId_key: { userId: interaction.user.id, key } },
    update: { value: JSON.stringify([...usedBaits]) },
    create: { userId: interaction.user.id, key, value: JSON.stringify([...usedBaits]) },
  });
  if (usedBaits.size >= fishingBaits.length) {
    const userGuildId = await getUserGuildId(interaction);
    await unlockBadge(userGuildId, 'bait_master');
  }
}

function renderFishingGame(state: FishingState, rodLevel: number) {
  const control = Array.from({ length: 3 }, (_, index) => index === state.position ? '🟦' : '─').join('');
  const fishLine = Array.from({ length: 3 }, (_, index) => index === state.target ? '🐟' : '─').join('');
  const progress = `${'🟩'.repeat(state.progress)}${'⬛'.repeat( 1 - state.progress)}`;
  const misses = '❤️'.repeat(3 - state.misses);
  const baitInfo = state.baitLuck ? `\nเหยื่อเพิ่มโชค **+${state.baitLuck}%**` : '';
  const embed = CafeEmbed.main('🎣 จังหวะตกปลา', [
    `Fish Line  ${fishLine}`,
    `Control Bar ${control}`,
    `Progress  ${progress}  ${misses}`,
    '',
    `ขยับตำแหน่งแล้วกดรีลเมื่อแถบอยู่ใกล้ปลา (ความแม่นยำเบ็ด +${fishingRods[rodLevel - 1].accuracy})${baitInfo}`,
  ].join('\n'));
  const components = [row(
    actionButton('fish_move_left', '⬅️ เลื่อนซ้าย'),
    actionButton('fish_reel', '🎣 รีล!', ButtonStyle.Success),
    actionButton('fish_move_right', 'เลื่อนขวา ➡️'),
  ), row(actionButton('fish_leave', 'ยกเลิก', ButtonStyle.Secondary))];
  return { embeds: [embed], components };
}

async function startFishing(interaction: ButtonInteraction, userGuildId: string) {
  const active = await readFishingState(interaction);
  if (active) {
    await interaction.reply({ content: 'คุณมีปลาติดเบ็ดอยู่แล้ว กลับไปเล่นรอบนั้นให้จบก่อนนะครับ 🎣', ephemeral: true });
    return;
  }
  const guild = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  const cooldownMinutes = guild?.fishingCooldownMinutes ?? 1;
  const cooldownType = `${interaction.guildId}_fishing`;
  const now = new Date();
  const cooldown = await prisma.cooldown.findUnique({ where: { userId_type: { userId: interaction.user.id, type: cooldownType } } });
  if (cooldownMinutes > 0 && cooldown && cooldown.expiresAt > now) {
    const minutes = Math.ceil((cooldown.expiresAt.getTime() - now.getTime()) / 60_000);
    await interaction.reply({ embeds: [CafeEmbed.info('พักมือก่อนนะครับ', `ตกปลาได้อีกในประมาณ ${minutes} นาทีครับ 🎣`)], ephemeral: true });
    return;
  }
  if (cooldownMinutes > 0) {
    const expiresAt = new Date(now.getTime() + cooldownMinutes * 60_000);
    await prisma.cooldown.upsert({
      where: { userId_type: { userId: interaction.user.id, type: cooldownType } },
      update: { expiresAt },
      create: { userId: interaction.user.id, type: cooldownType, expiresAt },
    });
  }

  const profile = await getProfile(userGuildId);
  let baitLuck = 0;
  let baitId = 'none';
  if (profile.equippedBait !== 'none') {
    const bait = fishingBaits.find((item) => item.id === profile.equippedBait);
    const inventory = bait ? await prisma.inventory.findUnique({
      where: { userGuildId_itemType_itemId: { userGuildId, itemType: 'bait', itemId: bait.id } },
    }) : null;
    if (bait && inventory && inventory.quantity > 0) {
      baitLuck = bait.luck;
      baitId = bait.id;
      await prisma.inventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });
      await recordBaitUse(interaction, bait.id);
    }
  }
  await profileUpdateBait(userGuildId);
  const state: FishingState = {
    position: 5,
    target: 2 + Math.floor(Math.random() * 7),
    progress: 0,
    misses: 0,
    expiresAt: Date.now() + 5 * 60_000,
    baitLuck,
    baitId,
  };
  await saveFishingState(interaction, state);
  await interaction.update(renderFishingGame(state, profile.rodLevel));
}

async function profileUpdateBait(userGuildId: string) {
  await prisma.fishingProfile.update({ where: { userGuildId }, data: { equippedBait: 'none' } });
}

async function catchFish(interaction: ButtonInteraction, userGuildId: string, baitLuck: number) {
  const profile = await getProfile(userGuildId);
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  const guildSettings = await prisma.guild.findUnique({ where: { id: userGuild.guildId } });
  const eventLuck = guildSettings?.fishingEventLuckUntil && guildSettings.fishingEventLuckUntil > new Date()
    ? guildSettings.fishingEventLuckBonus
    : 0;
  const luck = fishingRods[profile.rodLevel - 1].luck + baitLuck + (guildSettings?.fishingLuckBonus ?? 0) + eventLuck;
  const weights = fishCatalog.map((fish) => fish.weight * (1 + (fish.rarityIndex * luck) / 180));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let selection = Math.random() * totalWeight;
  let index = 0;
  for (; index < weights.length - 1; index += 1) {
    selection -= weights[index];
    if (selection <= 0) break;
  }
  const fish = fishCatalog[index];
  const reward = Math.max(1, Math.floor(fish.reward * userGuild.moneyMultiplier));
  const nextCount = profile.totalCatches + 1;
  const treasure = fish.rarityIndex >= 3 && Math.random() < Math.min(0.7, 0.12 + fish.rarityIndex * 0.06);
  const treasureId = treasure ? fish.rarityIndex >= 7 ? 'ancient_relic' : 'shimmering_scale' : null;
  await prisma.$transaction([
    prisma.fishingProfile.update({
      where: { userGuildId },
      data: { totalCatches: { increment: 1 }, biggestCatch: Math.max(profile.biggestCatch, fish.rarityIndex) },
    }),
    prisma.inventory.upsert({
      where: { userGuildId_itemType_itemId: { userGuildId, itemType: 'fish', itemId: fish.id } },
      update: { quantity: { increment: 1 } },
      create: { userGuildId, itemType: 'fish', itemId: fish.id, quantity: 1 },
    }),
    prisma.userGuild.update({ where: { id: userGuildId }, data: { money: { increment: reward } } }),
    ...(treasureId ? [prisma.inventory.upsert({
      where: { userGuildId_itemType_itemId: { userGuildId, itemType: 'fishing_treasure', itemId: treasureId } },
      update: { quantity: { increment: 1 } },
      create: { userGuildId, itemType: 'fishing_treasure', itemId: treasureId, quantity: 1 },
    })] : []),
  ]);
  const badges = [];
  if (nextCount === 1) badges.push(await unlockBadge(userGuildId, 'fishing_first'));
  if (nextCount >= 100) badges.push(await unlockBadge(userGuildId, 'fishing_100'));
  if (fish.rarityIndex >= 2) badges.push(await unlockBadge(userGuildId, 'fishing_rare'));
  if (fish.rarityIndex >= 7) badges.push(await unlockBadge(userGuildId, 'fishing_hidden'));
  if (fish.rarityId === 'jujutsu') badges.push(await unlockBadge(userGuildId, 'fishing_jujutsu'));
  if (fish.rarityId === 'vanguards') badges.push(await unlockBadge(userGuildId, 'fishing_vanguards'));
  if (profile.rodLevel === 12) badges.push(await unlockBadge(userGuildId, 'fishing_god_rod'));
  const speciesCount = await prisma.inventory.count({ where: { userGuildId, itemType: 'fish' } });
  if (speciesCount >= fishCatalog.length) badges.push(await unlockBadge(userGuildId, 'fish_complete_set'));
  const unlocked = badges.filter(Boolean).map((badge) => `${badge?.emoji} **${badge?.name}**`);
  await interaction.update({
    embeds: [CafeEmbed.success(`${fish.rarityEmoji} ${fish.rarity} • ${fish.name}`, `ขายปลาได้ **${reward.toLocaleString()} ฿**\n🍀 Luck รวม **${luck}%**${eventLuck ? ` (รวม Event +${eventLuck}%)` : ''}${treasure ? `\n🎁 พบไอเทมพิเศษ: **${treasureId === 'ancient_relic' ? 'โบราณวัตถุลึกลับ' : 'เกล็ดประกาย'}**` : ''}\n🐟 สะสมแล้ว **${nextCount}/100**${unlocked.length ? `\n\n🏅 Badge ใหม่: ${unlocked.join(', ')}` : ''}`)],
    components: [row(actionButton('fish_home', 'กลับท่าเรือ', ButtonStyle.Primary))],
  });
}

async function buyBait(interaction: ButtonInteraction, userGuildId: string, baitId: string) {
  const bait = fishingBaits.find((item) => item.id === baitId);
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  if (!bait || userGuild.money < bait.price) {
    await interaction.reply({ content: bait ? `เงินไม่พอครับ ต้องใช้ ${bait.price} ฿` : 'ไม่พบเหยื่อนี้ครับ', ephemeral: true });
    return;
  }
  const profile = await getProfile(userGuildId);
  await prisma.$transaction([
    prisma.userGuild.update({ where: { id: userGuildId }, data: { money: { decrement: bait.price } } }),
    prisma.inventory.upsert({
      where: { userGuildId_itemType_itemId: { userGuildId, itemType: 'bait', itemId: bait.id } },
      update: { quantity: { increment: 1 } },
      create: { userGuildId, itemType: 'bait', itemId: bait.id, quantity: 1 },
    }),
    prisma.fishingProfile.update({ where: { id: profile.id }, data: { equippedBait: bait.id } }),
  ]);
  await interaction.update({ embeds: [CafeEmbed.success('ซื้อเหยื่อแล้ว', `ได้รับ ${bait.emoji} **${bait.name}** 1 ชิ้น และเลือกใช้เป็นเหยื่อแล้ว\nโชคตกปลา **+${bait.luck}%**`)], components: [row(actionButton('fish_home', 'กลับท่าเรือ'))] });
}

export async function showFishingHub(interaction: ButtonInteraction, userGuildId: string) {
  const hub = await fishingHub(userGuildId);
  await interaction.reply({ ...hub, ephemeral: true });
}

export async function handleFishingButton(interaction: ButtonInteraction) {
  const userGuildId = await getUserGuildId(interaction);
  const id = interaction.customId;

  if (id === 'fish_home') {
    await interaction.update(await fishingHub(userGuildId));
    return;
  }
  if (id.startsWith('fish_collection:')) {
    const page = Math.max(0, Math.min(4, Number(id.split(':')[1]) || 0));
    const inventory = await prisma.inventory.findMany({ where: { userGuildId, itemType: 'fish' } });
    const owned = new Map(inventory.map((item) => [item.itemId, item.quantity]));
    const entries = fishCatalog.slice(page * 20, page * 20 + 20).map((fish) => {
      const quantity = owned.get(fish.id);
      return `${quantity ? '✅' : '🔒'} ${fish.rarityEmoji} **${fish.name}** • ${fish.rarity}${quantity ? ` x${quantity}` : ''}`;
    });
    await interaction.update({
      embeds: [CafeEmbed.main(`สมุดปลา • หน้า ${page + 1}/5`, `ค้นพบ **${owned.size}/${fishCatalog.length}** ชนิด${String.fromCharCode(10)}${String.fromCharCode(10)}${entries.join(String.fromCharCode(10))}`)],
      components: [row(
        actionButton(`fish_collection:${Math.max(0, page - 1)}`, '⬅️ ก่อนหน้า').setDisabled(page === 0),
        actionButton(`fish_collection:${Math.min(4, page + 1)}`, 'หน้าถัดไป ➡️').setDisabled(page === 4),
        actionButton('fish_home', '⚓ ท่าเรือ', ButtonStyle.Secondary),
      )],
    });
    return;
  }
  if (id === 'fish_start') {
    await startFishing(interaction, userGuildId);
    return;
  }
  if (id === 'fish_upgrade') {
    const profile = await getProfile(userGuildId);
    const next = fishingRods[profile.rodLevel];
    if (!next) {
      await interaction.reply({ content: 'คุณมีเบ็ดเทพระดับสูงสุดแล้วครับ ⚡', ephemeral: true });
      return;
    }
    const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
    if (userGuild.money < next.cost) {
      await interaction.reply({ content: `เงินไม่พอครับ ต้องใช้ ${next.cost.toLocaleString()} ฿ เพื่ออัปเป็น ${next.name}`, ephemeral: true });
      return;
    }
    await prisma.$transaction([
      prisma.userGuild.update({ where: { id: userGuildId }, data: { money: { decrement: next.cost } } }),
      prisma.fishingProfile.update({ where: { id: profile.id }, data: { rodLevel: { increment: 1 } } }),
    ]);
    if (profile.rodLevel + 1 === 12) await unlockBadge(userGuildId, 'fishing_god_rod');
    await interaction.update({ embeds: [CafeEmbed.success('อัปเกรดเบ็ดสำเร็จ', `ปลดล็อก **${next.name}** ระดับ ${profile.rodLevel + 1}/12\nโชคเบ็ด +${next.luck}% | ความแม่นยำ +${next.accuracy}`)], components: [row(actionButton('fish_home', 'กลับท่าเรือ'))] });
    return;
  }
  if (id === 'fish_bait_shop') {
    const rows = [];
    for (let index = 0; index < fishingBaits.length; index += 5) {
      rows.push(row(...fishingBaits.slice(index, index + 5).map((bait) => actionButton(`fish_buy_bait:${bait.id}`, `${bait.emoji} ${bait.name} ${bait.price}฿`))));
    }
    rows.push(row(actionButton('fish_home', 'กลับท่าเรือ')));
    await interaction.update({ embeds: [CafeEmbed.main('ร้านเหยื่อ', 'ซื้อเหยื่อ 1 ชิ้นแล้วระบบจะเลือกใช้ให้อัตโนมัติ เหยื่อถูกใช้ตอนเริ่มตกปลาและเพิ่มโอกาสพบปลาหายาก\n\n' + fishingBaits.map((bait) => `${bait.emoji} **${bait.name}** • ${bait.price} ฿ • โชค +${bait.luck}%`).join('\n'))], components: rows });
    return;
  }
  if (id === 'fish_bait_equip') {
    const inventory = await prisma.inventory.findMany({ where: { userGuildId, itemType: 'bait', quantity: { gt: 0 } } });
    if (!inventory.length) {
      await interaction.reply({ content: 'ยังไม่มีเหยื่อในกระเป๋าครับ ซื้อได้ที่ร้านเหยื่อ', ephemeral: true });
      return;
    }
    const baits = inventory.flatMap((item) => {
      const bait = fishingBaits.find((entry) => entry.id === item.itemId);
      return bait ? [actionButton(`fish_equip:${bait.id}`, `${bait.emoji} ${bait.name} x${item.quantity}`)] : [];
    });
    const rows = [];
    for (let index = 0; index < baits.length; index += 5) rows.push(row(...baits.slice(index, index + 5)));
    rows.push(row(actionButton('fish_home', 'กลับท่าเรือ')));
    await interaction.update({ embeds: [CafeEmbed.main('เลือกเหยื่อ', 'เลือกเหยื่อที่ต้องการใช้ในการตกปลารอบถัดไปครับ')], components: rows });
    return;
  }
  if (id.startsWith('fish_buy_bait:')) {
    await buyBait(interaction, userGuildId, id.split(':')[1]);
    return;
  }
  if (id.startsWith('fish_equip:')) {
    const baitId = id.split(':')[1];
    const owned = await prisma.inventory.findUnique({ where: { userGuildId_itemType_itemId: { userGuildId, itemType: 'bait', itemId: baitId } } });
    const bait = fishingBaits.find((item) => item.id === baitId);
    if (!owned || owned.quantity < 1 || !bait) {
      await interaction.reply({ content: 'ไม่พบเหยื่อนี้ในกระเป๋าครับ', ephemeral: true });
      return;
    }
    const profile = await getProfile(userGuildId);
    await prisma.fishingProfile.update({ where: { id: profile.id }, data: { equippedBait: bait.id } });
    await interaction.update({ embeds: [CafeEmbed.success('เลือกเหยื่อแล้ว', `รอบหน้าจะใช้ ${bait.emoji} **${bait.name}** เพิ่มโชค +${bait.luck}%`)], components: [row(actionButton('fish_home', 'กลับท่าเรือ'))] });
    return;
  }
  if (id === 'fish_leave') {
    const state = await readFishingState(interaction);
    if (state) await consumeFishingState(interaction, state);
    await interaction.update({ embeds: [CafeEmbed.info('เก็บเบ็ดแล้ว', 'ปลาหนีไปแล้วครับ ไว้มาเริ่มรอบใหม่กัน 🎣')], components: [row(actionButton('fish_home', 'กลับท่าเรือ'))] });
    return;
  }
  if (id.startsWith('fish_move_') || id === 'fish_reel') {
    const state = await readFishingState(interaction);
    if (!state) {
      await interaction.reply({ content: 'ปลาหนีไปแล้วครับ กลับไปเริ่มรอบใหม่ได้เลย 🎣', ephemeral: true });
      return;
    }
    const previousState = { ...state };
    const profile = await getProfile(userGuildId);
    if (id === 'fish_move_left') state.position = Math.max(0, state.position - 1);
    if (id === 'fish_move_right') state.position = Math.min(10, state.position + 1);
    if (id === 'fish_reel') {
      const inRange = Math.abs(state.position - state.target) <= Math.min(4, 1 + fishingRods[profile.rodLevel - 1].accuracy);
      if (inRange) state.progress += 1;
      else state.misses += 1;
      state.target = Math.max(0, Math.min(10, state.target + Math.floor(Math.random() * 5) - 2));
    }
    if (state.progress >= 4) {
      if (!(await consumeFishingState(interaction, previousState))) {
        await interaction.reply({ content: 'รอบนี้ถูกเล่นไปแล้วครับ 🎣', ephemeral: true });
        return;
      }
      await catchFish(interaction, userGuildId, state.baitLuck);
      return;
    }
    if (state.misses >= 3) {
      if (!(await consumeFishingState(interaction, previousState))) {
        await interaction.reply({ content: 'รอบนี้จบไปแล้วครับ 🎣', ephemeral: true });
        return;
      }
      await interaction.update({ embeds: [CafeEmbed.info('ปลาหลุดไปแล้ว', 'จังหวะรีลพลาดไปหน่อยครับ ลองอัปเกรดเบ็ดหรือใช้เหยื่อแล้วมาใหม่ได้เลย')], components: [row(actionButton('fish_home', 'กลับท่าเรือ'))] });
      return;
    }
    if (!(await replaceFishingState(interaction, previousState, state))) {
      await interaction.reply({ content: 'จังหวะนี้ถูกเล่นไปแล้วครับ', ephemeral: true });
      return;
    }
    await interaction.update(renderFishingGame(state, profile.rodLevel));
  }
}