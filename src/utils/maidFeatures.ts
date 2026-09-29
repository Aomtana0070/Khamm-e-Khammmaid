import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import prisma from '../database/prisma';
import CafeEmbed from './embeds';
import { maidEvents } from '../events/maidEvents';
import { handleFishingButton, showFishingHub } from './fishing';
import { handleMinigameButton, showMinigameMenu } from './minigames';
import { showBadges, unlockBadge } from './badges';

type ActivityKind = 'work' | 'fishing' | 'maid_talk' | 'minigame';

const activityChallenges: Record<ActivityKind, { prompt: string; options: string[]; answer: string }> = {
  work: {
    prompt: 'ลูกค้าสั่งลาเต้ 1 แก้ว คุณควรทำอะไรเพื่อส่งออเดอร์นี้ให้สำเร็จ?',
    options: ['ชงลาเต้ให้ลูกค้า', 'ยกเค้กไปเสิร์ฟ', 'เก็บโต๊ะว่าง'],
    answer: 'ชงลาเต้ให้ลูกค้า',
  },
  fishing: {
    prompt: 'รู้สึกถึงแรงดึงที่ปลายเบ็ดแล้ว จังหวะต่อไปควรทำอะไร?',
    options: ['ดึงคันเบ็ดขึ้น', 'เปลี่ยนเหยื่อทันที', 'เดินหนีไปก่อน'],
    answer: 'ดึงคันเบ็ดขึ้น',
  },
  maid_talk: {
    prompt: 'Maid บอกว่า “วันนี้เหนื่อยนิดหน่อย” คุณอยากตอบว่าอะไร?',
    options: ['พักก่อนนะ เป็นห่วงเสมอ', 'งั้นทำงานต่อเลย', 'ไว้ค่อยคุยกัน'],
    answer: 'พักก่อนนะ เป็นห่วงเสมอ',
  },
  minigame: {
    prompt: '',
    options: [],
    answer: '',
  },
};

const minigameChallenges = [
  { game: 'คิดเลขไว', prompt: '7 + 5 ได้เท่าไร?', options: ['10', '12', '14'], answer: '12' },
  { game: 'จำออเดอร์', prompt: 'จำออเดอร์: ชาเขียว → เค้ก → ลาเต้ รายการลำดับที่ 2 คืออะไร?', options: ['ชาเขียว', 'เค้ก', 'ลาเต้'], answer: 'เค้ก' },
  { game: 'ต่อแพตเทิร์น', prompt: 'เลขถัดไปของ 2, 4, 6, 8 คืออะไร?', options: ['9', '10', '12'], answer: '10' },
  { game: 'เรียงคำ', prompt: 'เรียงตัวอักษร ATE ให้เป็นเครื่องดื่มของคาเฟ่', options: ['TEA', 'EAT', 'ATE'], answer: 'TEA' },
  { game: 'ชงตามสูตร', prompt: 'ถ้าจะทำลาเต้ ขั้นตอนแรกควรเตรียมอะไร?', options: ['ช็อตเอสเปรสโซ', 'น้ำแข็งใส', 'วิปครีม'], answer: 'ช็อตเอสเปรสโซ' },
  { game: 'ทอนเงิน', prompt: 'ลูกค้าจ่าย 200 ฿ สำหรับออเดอร์ 145 ฿ ต้องทอนเท่าไร?', options: ['45 ฿', '55 ฿', '65 ฿'], answer: '55 ฿' },
  { game: 'จับสิ่งที่ต่าง', prompt: 'สัญลักษณ์ไหนต่างจากพวก: 🍓 🍓 🍋 🍓', options: ['🍓', '🍋', '🍓🍋'], answer: '🍋' },
  { game: 'จำลำดับ', prompt: 'จำลำดับ: เค้ก → ชา → ลาเต้ อะไรอยู่ถัดจากเค้ก?', options: ['ชา', 'ลาเต้', 'เค้ก'], answer: 'ชา' },
  { game: 'เลือกอุปกรณ์', prompt: 'ถ้าจะตกปลาในคาเฟ่ ควรเตรียมอะไร?', options: ['เหยื่อ', 'ถาดเสิร์ฟ', 'ที่ตีฟองนม'], answer: 'เหยื่อ' },
  { game: 'ปริศนาคาเฟ่', prompt: 'มี “หู” แต่ไม่ได้ยิน ใช้ถือเครื่องดื่ม สิ่งนั้นคืออะไร?', options: ['แก้วมีหู', 'ช้อน', 'จาน'], answer: 'แก้วมีหู' },
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildActivityChallenge(activity: ActivityKind) {
  const challenge = activity === 'minigame'
    ? minigameChallenges[Math.floor(Math.random() * minigameChallenges.length)]
    : activityChallenges[activity];
  const options = shuffle(challenge.options);
  const answerIndex = options.indexOf(challenge.answer);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...options.map((option, index) => new ButtonBuilder()
      .setCustomId(`maid_activity_answer:${activity}:${index}`)
      .setLabel(option)
      .setStyle(ButtonStyle.Primary)),
  );

  return { prompt: challenge.prompt, game: 'game' in challenge ? challenge.game : undefined, answerIndex, row };
}

async function storeChallenge(userId: string, guildId: string, key: string, answerIndex: number) {
  const memoryKey = `maid_challenge_${guildId}_${key}`;
  const value = JSON.stringify({ answerIndex, expiresAt: Date.now() + 10 * 60_000, completed: false });
  await prisma.memory.upsert({
    where: { userId_key: { userId, key: memoryKey } },
    update: { value },
    create: { userId, key: memoryKey, value },
  });
}

async function readChallenge(userId: string, guildId: string, key: string) {
  const memoryKey = `maid_challenge_${guildId}_${key}`;
  const memory = await prisma.memory.findUnique({ where: { userId_key: { userId, key: memoryKey } } });
  if (!memory) {
    return null;
  }

  const challenge = JSON.parse(memory.value) as { answerIndex: number; expiresAt: number; completed: boolean };
  if (challenge.completed || challenge.expiresAt < Date.now()) {
    return null;
  }
  return { memoryKey, storedValue: memory.value, ...challenge };
}

async function consumeChallenge(userId: string, challenge: Awaited<ReturnType<typeof readChallenge>>) {
  if (!challenge) {
    return false;
  }
  const result = await prisma.memory.updateMany({
    where: { userId, key: challenge.memoryKey, value: challenge.storedValue },
    data: { value: JSON.stringify({ ...challenge, completed: true }) },
  });
  return result.count === 1;
}

async function handleActivityAnswer(interaction: ButtonInteraction) {
  const [, activity, choiceIndexText] = interaction.customId.split(':');

  const activityKinds: ActivityKind[] = ['work', 'fishing', 'maid_talk', 'minigame'];
  if (!activityKinds.includes(activity as ActivityKind)) {
    await interaction.reply({ content: 'กิจกรรมนี้หมดเวลาแล้วครับ', ephemeral: true });
    return;
  }

  const challenge = await readChallenge(interaction.user.id, interaction.guildId!, `activity_${activity}`);
  if (!challenge) {
    await interaction.reply({ content: 'รอบนี้หมดเวลาแล้วหรือเล่นจบไปแล้วครับ เริ่มกิจกรรมใหม่ได้เลย 💕', ephemeral: true });
    return;
  }

  if (!(await consumeChallenge(interaction.user.id, challenge))) {
    await interaction.reply({ content: 'รอบนี้ถูกส่งคำตอบไปแล้วครับ 💕', ephemeral: true });
    return;
  }

  if (challenge.answerIndex !== Number(choiceIndexText)) {
    await interaction.update({
      embeds: [CafeEmbed.info('เกือบแล้วครับ', 'รอบนี้ยังทำไม่สำเร็จ แต่ขอบคุณที่ลงมือช่วยนะครับ ไว้มาเล่นด้วยกันใหม่ 💕')],
      components: [],
    });
    return;
  }

  const kind = activity as ActivityKind;
  const userGuild = await getUserGuild(interaction);
  let result: string;

  switch (kind) {
    case 'work': {
      const reward = 120 + Math.floor(Math.random() * 81);
      await prisma.userGuild.update({
        where: { id: userGuild.id },
        data: { jobExp: { increment: 20 }, ordersCompleted: { increment: 1 } },
      });
      const paidReward = await addActivityMoney(userGuild.id, reward);
      await addExperience(userGuild.id, 20);
      await unlockBadge(userGuild.id, 'work_first');
      if (userGuild.jobExp + 20 >= 200) await unlockBadge(userGuild.id, 'work_10');
      result = `ช่วยรับออเดอร์สำเร็จ ได้รับ 💰 **${paidReward} ฿** และ ⭐ **20 EXP** ครับ`;
      break;
    }
    case 'fishing': {
      const catches = [
        { id: 'small_fish', name: 'ปลาตัวเล็ก', emoji: '🐟', reward: 45 },
        { id: 'gold_fish', name: 'ปลาทอง', emoji: '🐠', reward: 140 },
        { id: 'squid', name: 'ปลาหมึก', emoji: '🦑', reward: 90 },
      ];
      const caught = catches[Math.floor(Math.random() * catches.length)];
      const foundCard = Math.random() < 0.1;
      if (foundCard) {
        await prisma.userGuild.update({ where: { id: userGuild.id }, data: { cardsOwned: { increment: 1 } } });
      }
      const paidReward = await addActivityMoney(userGuild.id, caught.reward);
      await addExperience(userGuild.id, 10);
      await addInventoryItem(userGuild.id, 'fish', caught.id);
      result = `ดึงเบ็ดทันเวลา จับได้ ${caught.emoji} **${caught.name}** ขายได้ 💰 **${paidReward} ฿** และ ⭐ **10 EXP**${foundCard ? '\n🎴 พบ Maid Card ระหว่างทาง +1 ใบ!' : ''}`;
      break;
    }
    case 'maid_talk': {
      const friendshipExp = 15 + Math.floor(Math.random() * 16);
      const foundCard = Math.random() < 0.2;
      if (foundCard) {
        await prisma.userGuild.update({ where: { id: userGuild.id }, data: { cardsOwned: { increment: 1 } } });
      }
      await addFriendshipExperience(userGuild.id, friendshipExp);
      await unlockBadge(userGuild.id, 'talk_first');
      result = `Maid ยิ้มกว้างที่คุณเป็นห่วง ได้รับ Friendship EXP **+${friendshipExp}**${foundCard ? '\n🎴 ความทรงจำดี ๆ ปลดล็อก Maid Card +1 ใบ!' : ''}`;
      break;
    }
    case 'minigame': {
      const reward = 80 + Math.floor(Math.random() * 121);
      const paidReward = await addActivityMoney(userGuild.id, reward);
      await addExperience(userGuild.id, 15);
      result = `ตอบถูกด้วยครับ! ได้รับ 💰 **${paidReward} ฿** และ ⭐ **15 EXP**`;
      break;
    }
  }

  await interaction.update({ embeds: [CafeEmbed.success('ทำกิจกรรมสำเร็จ', result)], components: [] });
}

function buildEventChallenge(eventId: string, eventInstance: string) {
  const challenges: Record<string, { prompt: string; options: string[]; answer: string }> = {
    cafe_rush: { prompt: 'ออเดอร์ด่วน: ลูกค้าสั่งชาเขียว 1 แก้ว ควรหยิบอะไร?', options: ['ชาเขียว', 'ลาเต้', 'น้ำส้ม'], answer: 'ชาเขียว' },
    fishing_hour: { prompt: 'ปลาที่บ่อคาเฟ่ชอบเหยื่อแบบไหนที่สุด?', options: ['ขนมปัง', 'ใบไม้', 'ช้อนชา'], answer: 'ขนมปัง' },
    talk_table: { prompt: 'เพื่อนที่โต๊ะบอกว่า “วันนี้เป็นวันที่ดีจัง” คุณจะตอบอย่างไร?', options: ['ดีใจด้วยนะ เล่าให้ฟังหน่อย', 'อย่าพูดเสียงดัง', 'งั้นกลับบ้านเถอะ'], answer: 'ดีใจด้วยนะ เล่าให้ฟังหน่อย' },
    card_hunt: { prompt: 'Maid ซ่อนการ์ดไว้หลังของชิ้นไหน ลองเลือกดูครับ!', options: ['แจกันดอกไม้', 'ถ้วยชา', 'ชั้นหนังสือ'], answer: ['แจกันดอกไม้', 'ถ้วยชา', 'ชั้นหนังสือ'][Math.floor(Math.random() * 3)] },
  };
  const challenge = challenges[eventId];
  const options = shuffle(challenge.options);
  const answerIndex = options.indexOf(challenge.answer);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...options.map((option, index) => new ButtonBuilder()
      .setCustomId(`maid_event_answer:${eventId}:${eventInstance}:${index}`)
      .setLabel(option)
      .setStyle(ButtonStyle.Primary)),
  );

  return { prompt: challenge.prompt, answerIndex, row };
}

async function handleEventAnswer(interaction: ButtonInteraction) {
  const [, eventId, eventInstance, choiceIndexText] = interaction.customId.split(':');
  const instanceTime = Number(eventInstance);
  if (!Number.isFinite(instanceTime) || Date.now() - instanceTime > 24 * 60 * 60_000) {
    await interaction.reply({ embeds: [CafeEmbed.error('Event หมดเวลา', 'กิจกรรมนี้หมดเวลาแล้วครับ รอรอบถัดไปได้เลย')], ephemeral: true });
    return;
  }

  const challenge = await readChallenge(interaction.user.id, interaction.guildId!, `event_${eventInstance}`);
  if (!challenge) {
    await interaction.reply({ content: 'รอบนี้หมดเวลาแล้วหรือเล่นจบไปแล้วครับ กดเข้าร่วม Event เพื่อเริ่มรอบใหม่ได้เลย 🎉', ephemeral: true });
    return;
  }

  if (!(await consumeChallenge(interaction.user.id, challenge))) {
    await interaction.reply({ content: 'รอบนี้ถูกส่งคำตอบไปแล้วครับ 🎉', ephemeral: true });
    return;
  }
  if (challenge.answerIndex !== Number(choiceIndexText)) {
    await interaction.update({
      embeds: [CafeEmbed.info('ขอบคุณที่ร่วมสนุก', 'คำตอบยังไม่ถูกครับ รอบนี้เลยยังรับรางวัลไม่ได้ ไว้มาเล่น Event ด้วยกันใหม่นะ 💕')],
      components: [],
    });
    return;
  }

  const event = maidEvents.find((item) => item.id === eventId);
  if (!event) {
    await interaction.update({ embeds: [CafeEmbed.error('Event หมดอายุ', 'กิจกรรมนี้ไม่พร้อมให้เข้าร่วมแล้วครับ')], components: [] });
    return;
  }

  const userGuild = await getUserGuild(interaction);
  const eventKey = `event_${eventId}_${eventInstance}`;
  try {
    await prisma.eventParticipation.create({
      data: { guildId: interaction.guildId!, userId: interaction.user.id, eventKey, reward: event.reward, exp: event.exp },
    });
  } catch (error) {
    const alreadyJoined = await prisma.eventParticipation.findUnique({
      where: { guildId_userId_eventKey: { guildId: interaction.guildId!, userId: interaction.user.id, eventKey } },
    });
    if (!alreadyJoined) {
      throw error;
    }
    await interaction.update({ embeds: [CafeEmbed.info('เข้าร่วมแล้ว', 'รับรางวัล Event รอบนี้ไปแล้วครับ ขอบคุณที่มาสนุกด้วยกัน 🎉')], components: [] });
    return;
  }

  const reward = await addActivityMoney(userGuild.id, event.reward);
  await addExperience(userGuild.id, event.exp);
  await unlockBadge(userGuild.id, 'event_first');
  const foundCard = eventId === 'card_hunt' && Math.random() < 0.25;
  if (foundCard) {
    await prisma.userGuild.update({ where: { id: userGuild.id }, data: { cardsOwned: { increment: 1 } } });
    await addInventoryItem(userGuild.id, 'card', 'maid_card_event');
      if (userGuild.cardsOwned + 1 >= 10) await unlockBadge(userGuild.id, 'card_10');
  }
  await interaction.update({
    embeds: [CafeEmbed.success(`ร่วม ${event.title} สำเร็จ`, `ตอบโจทย์ได้แล้วครับ! ได้รับ 💰 **${reward} ฿** และ ⭐ **${event.exp} EXP**${foundCard ? '\n🎴 พบ Maid Card พิเศษ +1 ใบ!' : ''}`)],
    components: [],
  });
}

const menu = [
  { id: 'strawberry_cake', name: 'Strawberry Cake', emoji: '🍰', price: 120 },
  { id: 'cafe_latte', name: 'Cafe Latte', emoji: '☕', price: 90 },
  { id: 'milk_tea', name: 'Milk Tea', emoji: '🧋', price: 80 },
  { id: 'thai_tea', name: 'Thai Tea', emoji: '🧋', price: 75 },
  { id: 'green_tea', name: 'Green Tea', emoji: '🍵', price: 70 },
  { id: 'matcha_latte', name: 'Matcha Latte', emoji: '🍵', price: 110 },
  { id: 'chocolate', name: 'Chocolate', emoji: '🍫', price: 95 },
  { id: 'strawberry_soda', name: 'Strawberry Soda', emoji: '🍓', price: 85 },
  { id: 'lemon_soda', name: 'Lemon Soda', emoji: '🍋', price: 80 },
  { id: 'blue_soda', name: 'Blue Soda', emoji: '🫧', price: 85 },
  { id: 'cocoa', name: 'Cocoa', emoji: '🥤', price: 90 },
  { id: 'caramel_macchiato', name: 'Caramel Macchiato', emoji: '☕', price: 125 },
  { id: 'vanilla_latte', name: 'Vanilla Latte', emoji: '☕', price: 115 },
  { id: 'honey_lemon', name: 'Honey Lemon', emoji: '🍯', price: 85 },
  { id: 'peach_tea', name: 'Peach Tea', emoji: '🍑', price: 90 },
  { id: 'mango_smoothie', name: 'Mango Smoothie', emoji: '🥭', price: 120 },
  { id: 'banana_smoothie', name: 'Banana Smoothie', emoji: '🍌', price: 115 },
  { id: 'watermelon_juice', name: 'Watermelon Juice', emoji: '🍉', price: 95 },
  { id: 'orange_juice', name: 'Orange Juice', emoji: '🍊', price: 90 },
  { id: 'milkshake', name: 'Milkshake', emoji: '🥛', price: 130 },
  { id: 'sparkling_water', name: 'Sparkling Water', emoji: '💧', price: 60 },
  { id: 'pudding', name: 'Caramel Pudding', emoji: '🍮', price: 75 },
  { id: 'cheesecake', name: 'Cheesecake', emoji: '🍰', price: 130 },
  { id: 'chocolate_cake', name: 'Chocolate Cake', emoji: '🍫', price: 125 },
  { id: 'macaron', name: 'Macaron', emoji: '🧁', price: 90 },
  { id: 'cookie', name: 'Cookie', emoji: '🍪', price: 55 },
  { id: 'brownie', name: 'Brownie', emoji: '🍫', price: 85 },
  { id: 'donut', name: 'Donut', emoji: '🍩', price: 65 },
  { id: 'crepe', name: 'Strawberry Crepe', emoji: '🥞', price: 110 },
  { id: 'waffle', name: 'Waffle', emoji: '🧇', price: 100 },
  { id: 'ice_cream', name: 'Ice Cream', emoji: '🍨', price: 80 },
  { id: 'mochi', name: 'Mochi', emoji: '🍡', price: 70 },
  { id: 'fruit_tart', name: 'Fruit Tart', emoji: '🥧', price: 120 },
  { id: 'honey_toast', name: 'Honey Toast', emoji: '🍞', price: 115 },
  { id: 'churros', name: 'Churros', emoji: '🥨', price: 85 },
  { id: 'thai_coconut_pancake', name: 'Coconut Pancake', emoji: '🥞', price: 90 },
  { id: 'red_bean_bun', name: 'Red Bean Bun', emoji: '🍞', price: 65 },
  { id: 'castella', name: 'Castella', emoji: '🍰', price: 95 },
  { id: 'dango', name: 'Dango', emoji: '🍡', price: 75 },
  { id: 'matcha_roll', name: 'Matcha Roll', emoji: '🍵', price: 115 },
  { id: 'almond_cake', name: 'Almond Cake', emoji: '🍰', price: 105 },
  { id: 'jasmine_rice', name: 'Jasmine Rice Set', emoji: '🍚', price: 100 },
  { id: 'basil_rice', name: 'Basil Chicken Rice', emoji: '🍛', price: 120 },
  { id: 'omelet_rice', name: 'Omelet Rice', emoji: '🍳', price: 110 },
  { id: 'curry_rice', name: 'Curry Rice', emoji: '🍛', price: 130 },
  { id: 'fried_rice', name: 'Fried Rice', emoji: '🍚', price: 115 },
  { id: 'garlic_pork_rice', name: 'Garlic Pork Rice', emoji: '🍖', price: 135 },
  { id: 'teriyaki_rice', name: 'Teriyaki Rice', emoji: '🍱', price: 145 },
  { id: 'katsu_rice', name: 'Katsu Rice', emoji: '🍱', price: 150 },
  { id: 'salmon_rice', name: 'Salmon Rice', emoji: '🍣', price: 180 },
  { id: 'beef_rice', name: 'Beef Rice Bowl', emoji: '🥩', price: 170 },
  { id: 'chicken_rice', name: 'Chicken Rice', emoji: '🍗', price: 125 },
  { id: 'pork_rice', name: 'Pork Rice Bowl', emoji: '🍖', price: 135 },
  { id: 'seafood_rice', name: 'Seafood Rice', emoji: '🦐', price: 190 },
  { id: 'green_curry_rice', name: 'Green Curry Rice', emoji: '🍛', price: 140 },
  { id: 'tom_yum_rice', name: 'Tom Yum Rice', emoji: '🍲', price: 145 },
  { id: 'rice_porridge', name: 'Rice Porridge', emoji: '🥣', price: 90 },
  { id: 'rice_bowl', name: 'Maid Rice Bowl', emoji: '🍚', price: 105 },
  { id: 'unagi_rice', name: 'Unagi Rice', emoji: '🍱', price: 200 },
  { id: 'tofu_rice', name: 'Tofu Rice Bowl', emoji: '🥗', price: 110 },
  { id: 'vegetable_rice', name: 'Vegetable Rice', emoji: '🥦', price: 100 },
];

const drinkMenu = menu.slice(1, 21);
const dessertMenu = [menu[0], ...menu.slice(22, 41)];
const riceMenu = menu.slice(41, 61);

const shopItems = [
  { id: 'cafe_latte', name: 'Cafe Latte', emoji: '☕', price: 90, type: 'drink' },
  { id: 'milk_tea', name: 'Milk Tea', emoji: '🧋', price: 80, type: 'drink' },
  { id: 'fishing_rod', name: 'Fishing Rod', emoji: '🎣', price: 350, type: 'tool' },
];

const rotatingShopItems = [
  { id: 'maid_ribbon', name: 'Maid Ribbon', emoji: '🎀', price: 450, type: 'cosmetic' },
  { id: 'lucky_charm', name: 'Lucky Charm', emoji: '🍀', price: 550, type: 'cosmetic' },
  { id: 'cafe_ticket', name: 'Café Ticket', emoji: '🎟️', price: 300, type: 'event_item' },
];

async function getUserGuild(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    throw new Error('This interaction can only be used in a server.');
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

async function isShopOpen(guildId: string | null) {
  if (!guildId) {
    return true;
  }
  const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { shopOpen: true } });
  return guild?.shopOpen ?? true;
}

function getRotatingShopItem() {
  const day = Math.floor(Date.now() / 86_400_000);
  return rotatingShopItems[day % rotatingShopItems.length];
}

async function getCooldownMinutes(guildId: string, type: string) {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) {
    return 0;
  }

  switch (type) {
    case 'work': return guild.workCooldownMinutes;
    case 'fishing': return guild.fishingCooldownMinutes;
    case 'maid_talk': return guild.maidTalkCooldownMinutes;
    case 'minigame': return guild.minigameCooldownMinutes;
    case 'daily': return guild.dailyCooldownMinutes;
    case 'quest': return guild.questCooldownMinutes;
    default: return 0;
  }
}

async function checkCooldown(userId: string, guildId: string, type: string, startCooldown = true) {
  const cooldownMinutes = await getCooldownMinutes(guildId, type);
  if (cooldownMinutes <= 0) {
    return 0;
  }

  const cooldownType = `${guildId}_${type}`;
  const now = new Date();
  const cooldown = await prisma.cooldown.findUnique({
    where: { userId_type: { userId, type: cooldownType } },
  });

  if (cooldown && cooldown.expiresAt > now) {
    return Math.ceil((cooldown.expiresAt.getTime() - now.getTime()) / 60_000);
  }

  if (!startCooldown) {
    return 0;
  }

  await prisma.cooldown.upsert({
    where: { userId_type: { userId, type: cooldownType } },
    update: { expiresAt: new Date(now.getTime() + cooldownMinutes * 60_000) },
    create: {
      userId,
      type: cooldownType,
      expiresAt: new Date(now.getTime() + cooldownMinutes * 60_000),
    },
  });

  return 0;
}

async function addInventoryItem(userGuildId: string, itemType: string, itemId: string) {
  await prisma.inventory.upsert({
    where: {
      userGuildId_itemType_itemId: { userGuildId, itemType, itemId },
    },
    update: { quantity: { increment: 1 } },
    create: { userGuildId, itemType, itemId, quantity: 1 },
  });
}

async function addExperience(userGuildId: string, amount: number) {
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  let level = userGuild.level;
  let exp = userGuild.exp + amount;
  let expToLevel = userGuild.expToLevel;
  let levelsGained = 0;

  while (exp >= expToLevel) {
    exp -= expToLevel;
    level += 1;
    levelsGained += 1;
    expToLevel = Math.round(expToLevel * 1.25);
  }

  await prisma.userGuild.update({
    where: { id: userGuildId },
    data: { level, exp, expToLevel },
  });

  return levelsGained;
}

async function addFriendshipExperience(userGuildId: string, amount: number) {
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  let level = userGuild.friendshipLevel;
  let exp = userGuild.friendshipExp + amount;
  let required = 100 + (level - 1) * 50;

  while (exp >= required) {
    exp -= required;
    level += 1;
    required = 100 + (level - 1) * 50;
  }

  await prisma.userGuild.update({
    where: { id: userGuildId },
    data: { friendshipLevel: level, friendshipExp: exp },
  });
}

async function addActivityMoney(userGuildId: string, baseAmount: number) {
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  const amount = Math.max(1, Math.floor(baseAmount * userGuild.moneyMultiplier));
  await prisma.userGuild.update({
    where: { id: userGuildId },
    data: { money: { increment: amount } },
  });
  return amount;
}

async function performRebirth(userGuildId: string) {
  const userGuild = await prisma.userGuild.findUniqueOrThrow({ where: { id: userGuildId } });
  const requiredLevel = 10 + userGuild.rebirth * 5;

  if (userGuild.level < requiredLevel) {
    return { requiredLevel, rebirth: userGuild.rebirth, multiplier: userGuild.moneyMultiplier };
  }

  const nextRebirth = userGuild.rebirth + 1;
  const multiplier = 1 + nextRebirth * 0.25;
  await prisma.userGuild.update({
    where: { id: userGuildId },
    data: {
      level: 1,
      exp: 0,
      expToLevel: 100,
      rebirth: nextRebirth,
      money: 500,
      moneyMultiplier: multiplier,
      jobLevel: 1,
      jobExp: 0,
    },
  });

  return { requiredLevel, rebirth: nextRebirth, multiplier };
}

function shopButtons() {
  const rotatingItem = getRotatingShopItem();
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('buy_cafe_latte').setLabel('☕ Latte 90 ฿').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('buy_milk_tea').setLabel('🧋 Milk Tea 80 ฿').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('buy_fishing_rod').setLabel('🎣 Rod 350 ฿').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('buy_rotating_item').setLabel(`${rotatingItem.emoji} ${rotatingItem.price} ฿`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('buy_card_pack').setLabel('🎴 Card Pack 300 ฿').setStyle(ButtonStyle.Danger),
  );
}

function giftButton(itemId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`gift_${itemId}`).setLabel('💝 มอบให้ Maid').setStyle(ButtonStyle.Success),
  );
}

async function handleDailyQuest(interaction: ButtonInteraction, userGuild: Awaited<ReturnType<typeof getUserGuild>>) {
  const questCooldown = await checkCooldown(interaction.user.id, interaction.guildId!, 'quest', false);
  if (questCooldown) {
    await interaction.reply({
      embeds: [CafeEmbed.info('ภารกิจยังติด cooldown', `รับภารกิจใหม่ได้ในอีกประมาณ ${questCooldown} นาทีครับ 🎯`)],
      ephemeral: true,
    });
    return;
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const questTypes = [
    { type: 'work', label: 'ทำงานที่ร้าน 1 ครั้ง' },
    { type: 'fish', label: 'ตกปลา 1 ครั้ง' },
    { type: 'order', label: 'สั่งอาหาร 1 รายการ' },
    { type: 'talk', label: 'คุยกับ Maid 1 ครั้ง' },
  ];
  const questMemory = await prisma.memory.findUnique({
    where: { userId_key: { userId: interaction.user.id, key: 'daily_quest' } },
  });
  const currentQuest = questMemory
    ? JSON.parse(questMemory.value) as { date: string; type: string; baseline: number; completed?: boolean }
    : null;

  if (!currentQuest || currentQuest.date !== dateKey) {
    const quest = questTypes[Math.floor(Math.random() * questTypes.length)];
    const baseline = quest.type === 'work'
      ? userGuild.jobExp
      : quest.type === 'order'
        ? userGuild.ordersCompleted
        : quest.type === 'talk'
          ? userGuild.friendshipExp
          : (await prisma.inventory.findMany({ where: { userGuildId: userGuild.id, itemType: 'fish' } }))
            .reduce((total, item) => total + item.quantity, 0);

    await prisma.memory.upsert({
      where: { userId_key: { userId: interaction.user.id, key: 'daily_quest' } },
      update: { value: JSON.stringify({ date: dateKey, type: quest.type, baseline }) },
      create: { userId: interaction.user.id, key: 'daily_quest', value: JSON.stringify({ date: dateKey, type: quest.type, baseline }) },
    });
    await interaction.reply({
      embeds: [CafeEmbed.info('ภารกิจประจำวัน', `ภารกิจวันนี้: **${quest.label}**\n\nทำเสร็จแล้วกดปุ่ม Quest อีกครั้งเพื่อรับ 💰 250 ฿ และ ⭐ 25 EXP ครับ`)],
      ephemeral: true,
    });
    return;
  }

  if (currentQuest.completed) {
    await interaction.reply({
      embeds: [CafeEmbed.info('ทำภารกิจแล้ว', 'ภารกิจวันนี้สำเร็จแล้วครับ กลับมาใหม่พรุ่งนี้ได้เลย 🎯')],
      ephemeral: true,
    });
    return;
  }

  const currentValue = currentQuest.type === 'work'
    ? userGuild.jobExp
    : currentQuest.type === 'order'
      ? userGuild.ordersCompleted
      : currentQuest.type === 'talk'
        ? userGuild.friendshipExp
        : (await prisma.inventory.findMany({ where: { userGuildId: userGuild.id, itemType: 'fish' } }))
          .reduce((total, item) => total + item.quantity, 0);

  if (currentValue <= currentQuest.baseline) {
    const quest = questTypes.find((item) => item.type === currentQuest.type);
    await interaction.reply({
      embeds: [CafeEmbed.info('ภารกิจยังไม่สำเร็จ', `ภารกิจวันนี้: **${quest?.label ?? 'ทำกิจกรรม 1 ครั้ง'}**\nทำกิจกรรมให้ครบก่อน แล้วกลับมากด Quest อีกครั้งครับ`)],
      ephemeral: true,
    });
    return;
  }

  await prisma.memory.update({
    where: { userId_key: { userId: interaction.user.id, key: 'daily_quest' } },
    data: { value: JSON.stringify({ ...currentQuest, completed: true }) },
  });
  if ((await getCooldownMinutes(interaction.guildId!, 'quest')) > 0) {
    const questCooldownMinutes = await getCooldownMinutes(interaction.guildId!, 'quest');
    const expiresAt = new Date(Date.now() + questCooldownMinutes * 60_000);
    const cooldownType = `${interaction.guildId}_quest`;
    await prisma.cooldown.upsert({
      where: { userId_type: { userId: interaction.user.id, type: cooldownType } },
      update: { expiresAt },
      create: { userId: interaction.user.id, type: cooldownType, expiresAt },
    });
  }
  const reward = await addActivityMoney(userGuild.id, 250);
  await addExperience(userGuild.id, 25);
  await unlockBadge(userGuild.id, 'quest_first');
  await interaction.reply({
    embeds: [CafeEmbed.success('Quest สำเร็จ', `ได้รับ 💰 **${reward} ฿** และ ⭐ **25 EXP** ครับ`)],
    ephemeral: true,
  });
}

export async function handleMaidButton(interaction: ButtonInteraction) {
  if (interaction.customId.startsWith('fish_')) {
    await handleFishingButton(interaction);
    return;
  }

  if (interaction.customId.startsWith('minigame_')) {
    await handleMinigameButton(interaction);
    return;
  }

  if (interaction.customId === 'badge_book') {
    const userGuild = await getUserGuild(interaction);
    await interaction.reply({ embeds: [await showBadges(userGuild.id)], ephemeral: true });
    return;
  }

  if (interaction.customId.startsWith('maid_activity_answer:')) {
    await handleActivityAnswer(interaction);
    return;
  }

  if (interaction.customId.startsWith('maid_event_answer:')) {
    await handleEventAnswer(interaction);
    return;
  }

  if (interaction.customId.startsWith('maid_event_join:')) {
    const [, eventId, eventInstance] = interaction.customId.split(':');
    const event = maidEvents.find((item) => item.id === eventId);
    if (!event) {
      await interaction.reply({ embeds: [CafeEmbed.error('Event หมดอายุ', 'กิจกรรมนี้ไม่พร้อมให้เข้าร่วมแล้วครับ')], ephemeral: true });
      return;
    }

    const instanceTime = Number(eventInstance);
    if (!Number.isFinite(instanceTime) || Date.now() - instanceTime > 24 * 60 * 60_000) {
      await interaction.reply({ embeds: [CafeEmbed.error('Event หมดเวลา', 'กิจกรรมนี้หมดเวลาแล้วครับ รอรอบถัดไปได้เลย')], ephemeral: true });
      return;
    }

    const eventKey = `event_${eventId}_${eventInstance}`;
    const alreadyJoined = await prisma.eventParticipation.findUnique({
      where: { guildId_userId_eventKey: { guildId: interaction.guildId!, userId: interaction.user.id, eventKey } },
    });
    const existingChallenge = await prisma.memory.findUnique({
      where: { userId_key: { userId: interaction.user.id, key: `maid_challenge_${interaction.guildId}_event_${eventInstance}` } },
    });
    if (alreadyJoined || existingChallenge) {
      await interaction.reply({ embeds: [CafeEmbed.info('ร่วมกิจกรรมแล้ว', 'คุณเริ่มเล่น Event รอบนี้ไปแล้ว ขอบคุณที่มาร่วมสนุกกับคาเฟ่นะครับ 💕')], ephemeral: true });
      return;
    }

    const challenge = buildEventChallenge(eventId, eventInstance);
    await storeChallenge(interaction.user.id, interaction.guildId!, `event_${eventInstance}`, challenge.answerIndex);
    await interaction.reply({
      embeds: [CafeEmbed.main(`เข้าร่วม Event • ${event.title}`, `${challenge.prompt}\n\nเลือกคำตอบเพื่อเล่นกิจกรรมให้สำเร็จก่อนรับรางวัลครับ`)],
      components: [challenge.row],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'menu_drinks') {
    await interaction.reply({ embeds: [menuCategoryEmbed('เครื่องดื่ม 20 รายการ', drinkMenu)], components: itemButtons(drinkMenu), ephemeral: true });
    return;
  }

  if (interaction.customId === 'menu_desserts') {
    await interaction.reply({ embeds: [menuCategoryEmbed('ขนม 20 รายการ', dessertMenu)], components: itemButtons(dessertMenu), ephemeral: true });
    return;
  }

  if (interaction.customId === 'menu_rice') {
    await interaction.reply({ embeds: [menuCategoryEmbed('อาหารข้าว 20 รายการ', riceMenu)], components: itemButtons(riceMenu), ephemeral: true });
    return;
  }

  if ((interaction.customId.startsWith('order_') && interaction.customId !== 'order_food') || interaction.customId.startsWith('gift_')) {
    const isGift = interaction.customId.startsWith('gift_');
    if (!isGift && !(await isShopOpen(interaction.guildId))) {
      await interaction.reply({
        embeds: [CafeEmbed.info('ร้านปิดอยู่ครับ', 'ตอนนี้ยังสั่งซื้อไม่ได้ครับ แวะกลับมาใหม่ตอนร้านเปิดนะครับ 🌙')],
        ephemeral: true,
      });
      return;
    }
    const itemId = interaction.customId.replace(isGift ? 'gift_' : 'order_', '');
    const item = menu.find((menuItem) => menuItem.id === itemId);
    if (!item) {
      await interaction.reply({ embeds: [CafeEmbed.error('ไม่พบเมนู', 'เมนูนี้ไม่พร้อมให้บริการแล้วครับ')], ephemeral: true });
      return;
    }

    const userGuild = await getUserGuild(interaction);
    const itemType = dessertMenu.some((menuItem) => menuItem.id === item.id)
      ? 'food'
      : riceMenu.some((menuItem) => menuItem.id === item.id) ? 'meal' : 'drink';

    if (isGift) {
      const ownedItem = await prisma.inventory.findUnique({
        where: { userGuildId_itemType_itemId: { userGuildId: userGuild.id, itemType, itemId } },
      });
      if (!ownedItem || ownedItem.quantity < 1) {
        await interaction.reply({ embeds: [CafeEmbed.error('ยังไม่มีไอเทม', `คุณไม่มี ${item.name} ในกระเป๋าครับ`)], ephemeral: true });
        return;
      }
      await prisma.inventory.update({ where: { id: ownedItem.id }, data: { quantity: { decrement: 1 } } });
      const friendshipGain = itemType === 'meal' ? 25 : itemType === 'food' ? 20 : 15;
      await addFriendshipExperience(userGuild.id, friendshipGain);
      await unlockBadge(userGuild.id, 'gift_first');
      await interaction.reply({ embeds: [CafeEmbed.success('Maid ดีใจมาก', `มอบ ${item.emoji} **${item.name}** ให้ Maid แล้วครับ\nได้รับ Friendship EXP **+${friendshipGain}** 💕`)], ephemeral: true });
      return;
    }

    if (userGuild.money < item.price) {
      await interaction.reply({ embeds: [CafeEmbed.error('เงินไม่พอ', `${item.name} ราคา ${item.price} ฿ แต่คุณมี ${userGuild.money} ฿ ครับ`)], ephemeral: true });
      return;
    }
    await prisma.$transaction([
      prisma.userGuild.update({ where: { id: userGuild.id }, data: { money: { decrement: item.price }, ordersCompleted: { increment: 1 } } }),
      prisma.inventory.upsert({
        where: { userGuildId_itemType_itemId: { userGuildId: userGuild.id, itemType, itemId } },
        update: { quantity: { increment: 1 } },
        create: { userGuildId: userGuild.id, itemType, itemId, quantity: 1 },
      }),
    ]);
    await addFriendshipExperience(userGuild.id, itemType === 'meal' ? 15 : 10);
    await unlockBadge(userGuild.id, 'order_first');
    if (userGuild.ordersCompleted + 1 >= 50) await unlockBadge(userGuild.id, 'order_50');
    await interaction.reply({
      embeds: [CafeEmbed.success('สั่งอาหารสำเร็จ', `ได้รับ ${item.emoji} **${item.name}** 1 ชิ้น\nใช้เงิน ${item.price} ฿ครับ`)],
      components: [giftButton(item.id)],
      ephemeral: true,
    });
    return;
  }

  switch (interaction.customId) {
    case 'menu_cafe': {
      await interaction.reply({
        embeds: [CafeEmbed.main('เมนูคาเฟ่', 'วันนี้มีเมนูให้เลือก 60 รายการ แบ่งเป็น 3 หมวดครับ\n\n🥤 เครื่องดื่ม 20 รายการ\n🍰 ขนม 20 รายการ\n🍚 อาหารข้าว 20 รายการ\n\nเลือกหมวดที่ต้องการดูได้เลยครับ')],
        components: [menuCategoryButtons()],
        ephemeral: true,
      });
      return;
    }

    case 'order_food':
      await interaction.reply({
        embeds: [CafeEmbed.main('สั่งอาหาร', 'เลือกหมวดอาหารก่อนครับ แล้วเลือกเมนูที่ต้องการสั่ง\n\nของที่ซื้อจะเก็บในกระเป๋าและนำไปมอบให้ Maid ได้ 💝')],
        components: [menuCategoryButtons()],
        ephemeral: true,
      });
      return;

    case 'order_strawberry_cake':
    case 'order_cafe_latte':
    case 'order_milk_tea': {
      const userGuild = await getUserGuild(interaction);
      const itemId = interaction.customId.replace('order_', '');
      const item = menu.find((menuItem) => menuItem.id === itemId);

      if (!item) {
        throw new Error('Food item not found.');
      }

      if (userGuild.money < item.price) {
        await interaction.reply({
          embeds: [CafeEmbed.error('เงินไม่พอ', `เมนู ${item.name} ราคา ${item.price} ฿ แต่คุณมี ${userGuild.money} ฿ ครับ`)],
          ephemeral: true,
        });
        return;
      }

      await prisma.$transaction([
        prisma.userGuild.update({
          where: { id: userGuild.id },
          data: {
            money: { decrement: item.price },
            ordersCompleted: { increment: 1 },
          },
        }),
        prisma.inventory.upsert({
          where: {
            userGuildId_itemType_itemId: {
              userGuildId: userGuild.id,
              itemType: item.id === 'strawberry_cake' ? 'food' : 'drink',
              itemId: item.id,
            },
          },
          update: { quantity: { increment: 1 } },
          create: {
            userGuildId: userGuild.id,
            itemType: item.id === 'strawberry_cake' ? 'food' : 'drink',
            itemId: item.id,
            quantity: 1,
          },
        }),
      ]);
      await addFriendshipExperience(userGuild.id, 10);
      await unlockBadge(userGuild.id, 'order_first');
      if (userGuild.ordersCompleted + 1 >= 50) await unlockBadge(userGuild.id, 'order_50');
      await unlockBadge(userGuild.id, 'gift_first');

      await interaction.reply({
        embeds: [CafeEmbed.success('สั่งอาหารสำเร็จ', `ได้รับ ${item.emoji} ${item.name} 1 ชิ้น\nใช้เงิน ${item.price} ฿ และได้รับ Friendship EXP +10 ครับ`)],
        components: [giftButton(item.id)],
        ephemeral: true,
      });
      return;
    }

    case 'gift_strawberry_cake':
    case 'gift_cafe_latte':
    case 'gift_milk_tea': {
      const userGuild = await getUserGuild(interaction);
      const itemId = interaction.customId.replace('gift_', '');
      const item = menu.find((menuItem) => menuItem.id === itemId);

      if (!item) {
        throw new Error('Gift item not found.');
      }

      const ownedItem = await prisma.inventory.findUnique({
        where: {
          userGuildId_itemType_itemId: {
            userGuildId: userGuild.id,
            itemType: item.id === 'strawberry_cake' ? 'food' : 'drink',
            itemId,
          },
        },
      });

      if (!ownedItem || ownedItem.quantity < 1) {
        await interaction.reply({
          embeds: [CafeEmbed.error('ยังไม่มีไอเทม', `คุณไม่มี ${item.name} ใน Inventory ครับ`)],
          ephemeral: true,
        });
        return;
      }

      const friendshipGain = item.id === 'strawberry_cake' ? 20 : 15;
      await prisma.$transaction([
        prisma.inventory.update({
          where: { id: ownedItem.id },
          data: { quantity: { decrement: 1 } },
        }),
      ]);
      await addFriendshipExperience(userGuild.id, friendshipGain);

      await interaction.reply({
        embeds: [CafeEmbed.success('Maid ดีใจมาก', `มอบ ${item.emoji} **${item.name}** ให้ Maid แล้วครับ\nได้รับ Friendship EXP **+${friendshipGain}** 💕`)],
        ephemeral: true,
      });
      return;
    }

    case 'shop': {
      const rotatingItem = getRotatingShopItem();
      const shopOpen = await isShopOpen(interaction.guildId);
      const shopEmbed = CafeEmbed.main(shopOpen ? 'ร้านค้าคาเฟ่ • เปิดอยู่' : 'ร้านค้าคาเฟ่ • ปิดอยู่', shopOpen
        ? 'ของใช้ประจำวันและสินค้าพิเศษหมุนเวียนรอคุณอยู่ครับ 🛒'
        : 'ร้านปิดชั่วคราวครับ แวะดูรายการไว้ก่อนได้ แล้วกลับมาใหม่ตอนเปิดนะครับ 🌙')
        .addFields(
          ...shopItems.map((item) => ({ name: `${item.emoji} ${item.name}`, value: `${item.price} ฿`, inline: true })),
          { name: '🎴 Card Pack', value: '300 ฿  •  สุ่มการ์ดหลายระดับ', inline: true },
          { name: `🌟 สินค้าพิเศษวันนี้ ${rotatingItem.emoji}`, value: `${rotatingItem.name}  •  ${rotatingItem.price} ฿`, inline: false },
        );
      await interaction.reply({
        embeds: [shopEmbed],
        components: [shopButtons()],
        ephemeral: true,
      });
      return;
    }

    case 'buy_cafe_latte':
    case 'buy_milk_tea':
    case 'buy_fishing_rod': {
      if (!(await isShopOpen(interaction.guildId))) {
        await interaction.reply({ embeds: [CafeEmbed.info('ร้านปิดอยู่ครับ', 'ตอนนี้ร้านยังไม่เปิดให้ซื้อของครับ แล้วแวะกลับมาใหม่นะครับ 🌙')], ephemeral: true });
        return;
      }
      const userGuild = await getUserGuild(interaction);
      const itemId = interaction.customId.replace('buy_', '');
      const item = shopItems.find((shopItem) => shopItem.id === itemId);

      if (!item) {
        throw new Error('Shop item not found.');
      }

      if (userGuild.money < item.price) {
        await interaction.reply({
          embeds: [CafeEmbed.error('เงินไม่พอ', `ต้องใช้ ${item.price} ฿ แต่คุณมี ${userGuild.money} ฿ ครับ`)],
          ephemeral: true,
        });
        return;
      }

      await prisma.userGuild.update({
        where: { id: userGuild.id },
        data: { money: { decrement: item.price } },
      });
      await addInventoryItem(userGuild.id, item.type, item.id);

      await interaction.reply({
        embeds: [CafeEmbed.success('ซื้อสำเร็จ', `ได้รับ ${item.emoji} **${item.name}** 1 ชิ้นครับ`)],
        ephemeral: true,
      });
      return;
    }

    case 'buy_rotating_item': {
      if (!(await isShopOpen(interaction.guildId))) {
        await interaction.reply({ embeds: [CafeEmbed.info('ร้านปิดอยู่ครับ', 'ตอนนี้ร้านยังไม่เปิดให้ซื้อของครับ แล้วแวะกลับมาใหม่นะครับ 🌙')], ephemeral: true });
        return;
      }
      const userGuild = await getUserGuild(interaction);
      const item = getRotatingShopItem();

      if (userGuild.money < item.price) {
        await interaction.reply({
          embeds: [CafeEmbed.error('เงินไม่พอ', `สินค้าพิเศษวันนี้ราคา ${item.price} ฿ แต่คุณมี ${userGuild.money} ฿ ครับ`)],
          ephemeral: true,
        });
        return;
      }

      await prisma.userGuild.update({ where: { id: userGuild.id }, data: { money: { decrement: item.price } } });
      await addInventoryItem(userGuild.id, item.type, item.id);
      await interaction.reply({
        embeds: [CafeEmbed.success('ซื้อสินค้าพิเศษสำเร็จ', `ได้รับ ${item.emoji} **${item.name}** ครับ สินค้าจะเปลี่ยนในวันถัดไป`)],
        ephemeral: true,
      });
      return;
    }

    case 'buy_card_pack': {
      if (!(await isShopOpen(interaction.guildId))) {
        await interaction.reply({ embeds: [CafeEmbed.info('ร้านปิดอยู่ครับ', 'ตอนนี้ร้านยังไม่เปิดให้ซื้อของครับ แล้วแวะกลับมาใหม่นะครับ 🌙')], ephemeral: true });
        return;
      }
      const userGuild = await getUserGuild(interaction);
      const price = 300;

      if (userGuild.money < price) {
        await interaction.reply({
          embeds: [CafeEmbed.error('เงินไม่พอ', `Card Pack ราคา ${price} ฿ แต่คุณมี ${userGuild.money} ฿ ครับ`)],
          ephemeral: true,
        });
        return;
      }

      const cards = [
        { id: 'maid_card_common', name: 'Common Maid Card', emoji: '🎀', rarity: 'Common' },
        { id: 'maid_card_rare', name: 'Rare Maid Card', emoji: '✨', rarity: 'Rare' },
        { id: 'maid_card_epic', name: 'Epic Maid Card', emoji: '💎', rarity: 'Epic' },
      ];
      const roll = Math.random();
      const card = roll < 0.7 ? cards[0] : roll < 0.95 ? cards[1] : cards[2];

      await prisma.userGuild.update({
        where: { id: userGuild.id },
        data: { money: { decrement: price }, cardsOwned: { increment: 1 } },
      });
      await addInventoryItem(userGuild.id, 'card', card.id);
      if (userGuild.cardsOwned + 1 >= 10) await unlockBadge(userGuild.id, 'card_10');

      await interaction.reply({
        embeds: [CafeEmbed.success('เปิด Card Pack สำเร็จ', `ได้ ${card.emoji} **${card.name}** (${card.rarity}) ครับ`)],
        ephemeral: true,
      });
      return;
    }

    case 'profile': {
      const userGuild = await getUserGuild(interaction);
      await interaction.reply({
        embeds: [CafeEmbed.main('โปรไฟล์ของคุณ', `**👤 ${interaction.user.username}**\n\nLv. ${userGuild.level} | Rebirth: ${userGuild.rebirth}\n⭐ EXP: ${userGuild.exp}/${userGuild.expToLevel}\n💰 เงิน: ${userGuild.money} ฿ (ตัวคูณ x${userGuild.moneyMultiplier.toFixed(2)})\n🤝 Friendship: Lv. ${userGuild.friendshipLevel}\n🧾 ออเดอร์สำเร็จ: ${userGuild.ordersCompleted}`)],
        ephemeral: true,
      });
      return;
    }

    case 'wallet': {
      const userGuild = await getUserGuild(interaction);
      await interaction.reply({
        embeds: [CafeEmbed.info('กระเป๋าเงิน', `💰 เงินสด: **${userGuild.money} ฿**\n📈 ตัวคูณกิจกรรม: **x${userGuild.moneyMultiplier.toFixed(2)}**\n♻️ Rebirth: **${userGuild.rebirth}**\n💎 Maid Gems: **${userGuild.maidGems}**\n⭐ Café Points: **${userGuild.cafePoints}**`)],
        ephemeral: true,
      });
      return;
    }

    case 'daily_reward': {
      const userGuild = await getUserGuild(interaction);
      const guild = await prisma.guild.findUniqueOrThrow({ where: { id: interaction.guildId! } });
      const now = new Date();
      const lastDaily = userGuild.lastDaily;
      const dailyCooldownMinutes = guild.dailyCooldownMinutes;
      const minutesSinceDaily = lastDaily ? (now.getTime() - lastDaily.getTime()) / 60_000 : dailyCooldownMinutes;

      if (dailyCooldownMinutes > 0 && minutesSinceDaily < dailyCooldownMinutes) {
        const minutesRemaining = Math.ceil(dailyCooldownMinutes - minutesSinceDaily);
        await interaction.reply({
          embeds: [CafeEmbed.info('รับ Daily แล้ว', `กลับมารับรางวัลใหม่ได้ในอีกประมาณ ${minutesRemaining} นาทีครับ 🎁`)],
          ephemeral: true,
        });
        return;
      }

      const reward = Math.min(guild.dailyReward + userGuild.dailyStreak * 10, guild.dailyMax);
      await prisma.userGuild.update({
        where: { id: userGuild.id },
        data: {
          lastDaily: now,
          dailyStreak: { increment: 1 },
        },
      });
      const paidReward = await addActivityMoney(userGuild.id, reward);
      await unlockBadge(userGuild.id, 'daily_first');
      if (userGuild.dailyStreak + 1 >= 7) await unlockBadge(userGuild.id, 'streak_7');

      await interaction.reply({
        embeds: [CafeEmbed.success('Daily Reward', `ได้รับ 💰 **${paidReward} ฿** ครับ\nStreak ปัจจุบัน: **${userGuild.dailyStreak + 1} วัน**`)],
        ephemeral: true,
      });
      return;
    }

    case 'rebirth': {
      const userGuild = await getUserGuild(interaction);
      const result = await performRebirth(userGuild.id);

      if (result.rebirth === userGuild.rebirth) {
        await interaction.reply({
          embeds: [CafeEmbed.info('ยัง Rebirth ไม่ได้', `ต้องมีเลเวล **${result.requiredLevel}** ก่อนครับ\nตอนนี้คุณอยู่ Lv. ${userGuild.level}`)],
          ephemeral: true,
        });
        return;
      }

      await unlockBadge(userGuild.id, 'rebirth_first');
      await interaction.reply({
        embeds: [CafeEmbed.success('Rebirth สำเร็จ', `เริ่มต้นใหม่ที่ Lv. 1\n♻️ Rebirth: **${result.rebirth}**\n📈 ตัวคูณเงินกิจกรรมใหม่: **x${result.multiplier.toFixed(2)}**\n💰 เงินเริ่มต้น: **500 ฿**`)],
        ephemeral: true,
      });
      return;
    }

    case 'quest': {
      const userGuild = await getUserGuild(interaction);
      await handleDailyQuest(interaction, userGuild);
      return;
    }

    case 'card': {
      const userGuild = await getUserGuild(interaction);
      const cards = await prisma.inventory.findMany({
        where: { userGuildId: userGuild.id, itemType: 'card' },
        orderBy: { createdAt: 'asc' },
      });
      const cardList = cards.length ? cards.map((card) => `• ${card.itemId} x${card.quantity}`).join('\n') : 'ยังไม่มีการ์ดรายใบ';
      await interaction.reply({
        embeds: [CafeEmbed.main('Maid Card', `คุณมี Maid Card อยู่ **${userGuild.cardsOwned} ใบ** ครับ 🎴\n\n${cardList}\n\nซื้อเพิ่มได้จากร้านค้าโดยกดปุ่ม Shop ครับ`)],
        ephemeral: true,
      });
      return;
    }

    case 'inventory': {
      const userGuild = await getUserGuild(interaction);
      const inventory = await prisma.inventory.findMany({
        where: { userGuildId: userGuild.id },
        orderBy: { createdAt: 'asc' },
      });
      const description = inventory.length
        ? inventory.map((item) => `• ${item.itemId} x${item.quantity}`).join('\n')
        : 'ยังไม่มีไอเทมในกระเป๋าครับ';
      const giftableItems = inventory
        .filter((item) => item.itemType === 'food' || item.itemType === 'drink')
        .slice(0, 5);
      const inventoryButtons = giftableItems.length
        ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...giftableItems.map((item) => new ButtonBuilder()
              .setCustomId(`gift_${item.itemId}`)
              .setLabel(`💝 มอบ ${item.itemId}`)
              .setStyle(ButtonStyle.Success)),
          )]
        : [];

      await interaction.reply({
        embeds: [CafeEmbed.main('Inventory', description)],
        components: inventoryButtons,
        ephemeral: true,
      });
      return;
    }

    case 'leaderboard': {
      const guildId = interaction.guildId;
      if (!guildId) {
        throw new Error('This interaction can only be used in a server.');
      }

      const leaderboard = await prisma.userGuild.findMany({
        where: { guildId },
        orderBy: [{ money: 'desc' }, { level: 'desc' }],
        take: 10,
        include: { user: true },
      });
      const description = leaderboard.length
        ? leaderboard.map((entry, index) => `${index + 1}. **${entry.user.username}** - ${entry.money} ฿ (Lv. ${entry.level})`).join('\n')
        : 'ยังไม่มีข้อมูล Ranking ครับ';

      await interaction.reply({
        embeds: [CafeEmbed.main('Ranking', description)],
        ephemeral: true,
      });
      return;
    }

    case 'work_shop': {
      const minutesRemaining = await checkCooldown(interaction.user.id, interaction.guildId!, 'work');

      if (minutesRemaining) {
        await interaction.reply({
          embeds: [CafeEmbed.info('พักจากงานก่อนนะครับ', `กลับมาทำงานได้ในอีก ${minutesRemaining} นาทีครับ 🧹`)],
          ephemeral: true,
        });
        return;
      }

      const challenge = buildActivityChallenge('work');
      await storeChallenge(interaction.user.id, interaction.guildId!, 'activity_work', challenge.answerIndex);
      await interaction.reply({
        embeds: [CafeEmbed.main('กะทำงานที่คาเฟ่', `${challenge.prompt}\n\nเลือกการกระทำเพื่อช่วยลูกค้าให้สำเร็จก่อนรับค่าจ้างครับ`)],
        components: [challenge.row],
        ephemeral: true,
      });
      return;
    }

    case 'fishing': {
      const userGuild = await getUserGuild(interaction);
      await showFishingHub(interaction, userGuild.id);
      return;
    }

    case 'maid_talk': {
      const minutesRemaining = await checkCooldown(interaction.user.id, interaction.guildId!, 'maid_talk');

      if (minutesRemaining) {
        await interaction.reply({
          embeds: [CafeEmbed.info('คุยกับ Maid', `วันนี้คุยกันไปแล้วครับ กลับมาคุยใหม่ในอีก ${minutesRemaining} นาที 💬`)],
          ephemeral: true,
        });
        return;
      }

      const challenge = buildActivityChallenge('maid_talk');
      await storeChallenge(interaction.user.id, interaction.guildId!, 'activity_maid_talk', challenge.answerIndex);
      await interaction.reply({
        embeds: [CafeEmbed.main('บทสนทนาที่คาเฟ่', `${challenge.prompt}\n\nเลือกคำตอบที่อยากพูด แล้วมาคุยกับ Maid ต่อกันครับ ☕`)],
        components: [challenge.row],
        ephemeral: true,
      });
      return;
    }

    case 'mini_game': {
      await showMinigameMenu(interaction);
      return;
    }

    case 'help_menu':
      await interaction.reply({
        embeds: [CafeEmbed.info('Help', '🍰 เมนูคาเฟ่ - ดูรายการอาหาร\n🧾 สั่งอาหาร - ซื้อเมนู\n👤 โปรไฟล์ - ดูเลเวลและสถิติ\n💰 กระเป๋าเงิน - ดูเงินและแต้ม\n🎁 Daily - รับรางวัลประจำวัน\n🎯 Quest - ทำภารกิจ\n🎴 Maid Card - ดูการ์ดสะสม\n🎒 Inventory - ดูไอเทม\n🏅 Badges - ดูสมุดความสำเร็จ\n🏆 Ranking - ดูอันดับในเซิร์ฟเวอร์\n\n🧹 ทำงานที่ร้าน - เล่น action รับออเดอร์\n🎣 ตกปลา - คุมแถบรีล ลุ้นปลา 100 ชนิด อัปเบ็ดและใช้เหยื่อได้\n💬 คุยกับ Maid - เพิ่ม Friendship\n🎲 มินิเกม - XO, หาทุ่นระเบิด และเป่ายิ้งฉุบ\n\n💗 /love บอกรัก Maid  •  🤗 /hug Lv.2  •  🌸 /kiss Lv.5')],
        ephemeral: true,
      });
      return;

    default:
      await interaction.reply({
        embeds: [CafeEmbed.error('ไม่พบปุ่ม', 'ปุ่มนี้ไม่พร้อมใช้งานแล้ว กรุณาใช้คำสั่ง `/maid` ใหม่ครับ')],
        ephemeral: true,
      });
  }
}

function menuCategoryButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('menu_drinks').setLabel('🥤 เครื่องดื่ม 20').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu_desserts').setLabel('🍰 ขนม 20').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu_rice').setLabel('🍚 ข้าว 20').setStyle(ButtonStyle.Danger),
  );
}

function itemButtons(items: typeof menu) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < items.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...items.slice(index, index + 5).map((item) => new ButtonBuilder()
        .setCustomId(`order_${item.id}`)
        .setLabel(`${item.emoji} ${item.name.slice(0, 70)} ${item.price}฿`)
        .setStyle(ButtonStyle.Primary)),
    ));
  }
  return rows;
}

function menuCategoryEmbed(title: string, items: typeof menu) {
  return CafeEmbed.main(title, 'เลือกเมนูที่ต้องการสั่งได้เลยครับ รายการที่ซื้อจะเก็บในกระเป๋าและมอบให้ Maid ได้ 💝')
    .addFields(items.map((item) => ({
      name: `${item.emoji} ${item.name}`,
      value: `**${item.price} ฿**`,
      inline: true,
    })));
}