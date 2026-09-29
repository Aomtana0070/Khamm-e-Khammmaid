import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import prisma from '../database/prisma';
import CafeEmbed from './embeds';
import { unlockBadge } from './badges';

type GameState = {
  game: 'xo' | 'mines' | 'rps';
  board?: string[];
  bombs?: number[];
  revealed?: number[];
  expiresAt: number;
  finished?: boolean;
  storedValue?: string;
};

const button = (id: string, label: string, style = ButtonStyle.Primary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

async function saveState(interaction: ButtonInteraction, state: GameState | null) {
  const key = `minigame_state_${interaction.guildId}`;
  if (!state) {
    await prisma.memory.deleteMany({ where: { userId: interaction.user.id, key } });
    return;
  }
  const { storedValue: _storedValue, ...value } = state;
  const serialized = JSON.stringify(value);
  await prisma.memory.upsert({
    where: { userId_key: { userId: interaction.user.id, key } },
    update: { value: serialized },
    create: { userId: interaction.user.id, key, value: serialized },
  });
}

async function loadState(interaction: ButtonInteraction) {
  const key = `minigame_state_${interaction.guildId}`;
  const memory = await prisma.memory.findUnique({ where: { userId_key: { userId: interaction.user.id, key } } });
  if (!memory) return null;
  const state = JSON.parse(memory.value) as GameState;
  return !state.finished && state.expiresAt > Date.now() ? { ...state, storedValue: memory.value } : null;
}

async function replaceState(interaction: ButtonInteraction, current: GameState, next: GameState) {
  const key = `minigame_state_${interaction.guildId}`;
  const { storedValue: _storedValue, ...value } = next;
  const result = await prisma.memory.updateMany({
    where: { userId: interaction.user.id, key, value: current.storedValue },
    data: { value: JSON.stringify(value) },
  });
  return result.count === 1;
}

async function consumeState(interaction: ButtonInteraction, state: GameState) {
  const result = await prisma.memory.deleteMany({
    where: { userId: interaction.user.id, key: `minigame_state_${interaction.guildId}`, value: state.storedValue },
  });
  return result.count === 1;
}

async function grantReward(interaction: ButtonInteraction, amount: number, exp: number, badgeIds: string[] = []) {
  const userGuild = await prisma.userGuild.findUnique({
    where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guildId! } },
  });
  if (!userGuild) return 0;
  const reward = Math.floor(amount * userGuild.moneyMultiplier);
  let level = userGuild.level;
  let currentExp = userGuild.exp + exp;
  let expToLevel = userGuild.expToLevel;
  while (currentExp >= expToLevel) {
    currentExp -= expToLevel;
    level += 1;
    expToLevel = Math.round(expToLevel * 1.25);
  }
  await prisma.$transaction([
    prisma.userGuild.update({ where: { id: userGuild.id }, data: { money: { increment: reward } } }),
    prisma.userGuild.update({ where: { id: userGuild.id }, data: { level, exp: currentExp, expToLevel } }),
  ]);
  for (const badgeId of badgeIds) await unlockBadge(userGuild.id, badgeId);
  return reward;
}

async function checkCooldown(interaction: ButtonInteraction) {
  const guild = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  const minutes = guild?.minigameCooldownMinutes ?? 10;
  if (minutes <= 0) return true;
  const type = `${interaction.guildId}_minigame`;
  const now = new Date();
  const current = await prisma.cooldown.findUnique({ where: { userId_type: { userId: interaction.user.id, type } } });
  if (current && current.expiresAt > now) {
    const left = Math.ceil((current.expiresAt.getTime() - now.getTime()) / 60_000);
    await interaction.reply({ embeds: [CafeEmbed.info('พักจากมินิเกมก่อน', `เริ่มรอบใหม่ได้ในอีก ${left} นาทีครับ 🎲`)], ephemeral: true });
    return false;
  }
  const expiresAt = new Date(now.getTime() + minutes * 60_000);
  await prisma.cooldown.upsert({
    where: { userId_type: { userId: interaction.user.id, type } },
    update: { expiresAt },
    create: { userId: interaction.user.id, type, expiresAt },
  });
  return true;
}

export async function showMinigameMenu(interaction: ButtonInteraction) {
  const active = await loadState(interaction);
  if (active) {
    await interaction.reply({ content: 'คุณมีเกมที่ยังเล่นไม่จบอยู่ครับ กลับไปกดปุ่มบนข้อความเกมเดิมได้เลย 🎮', ephemeral: true });
    return;
  }
  await interaction.reply({
    embeds: [CafeEmbed.main('🎮 เลือกมินิเกม', [
      'เลือกเกมที่อยากเล่น รอบใหม่จะเริ่มนับ cooldown ตอนเริ่มเกมครับ',
      '⭕ **XO** • วาง X สู้กับบอต',
      '💣 **หาทุ่นระเบิด** • เปิดช่องหาสมบัติ 5 ช่อง',
      '✊ **เป่ายิ้งฉุบ** • ดวลกับ Maid 1 รอบ',
    ].join(String.fromCharCode(10)))],
    components: [row(button('minigame_start:xo', '⭕ XO'), button('minigame_start:mines', '💣 หาทุ่น'), button('minigame_start:rps', '✊ เป่ายิ้งฉุบ'))],
    ephemeral: true,
  });
}

function renderXo(board: string[]) {
  const symbols = board.map((cell, index) => cell || `${index + 1}️⃣`);
  const components = [0, 1, 2].map((rowIndex) => row(...[0, 1, 2].map((column) => {
    const index = rowIndex * 3 + column;
    return button(`minigame_xo:${index}`, symbols[index], board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(Boolean(board[index]));
  })));
  const boardText = [symbols.slice(0, 3).join('  '), symbols.slice(3, 6).join('  '), symbols.slice(6, 9).join('  ')].join(String.fromCharCode(10));
  return { embeds: [CafeEmbed.main('⭕ Tic-Tac-Toe', `คุณคือ **X** • บอตคือ **O**${String.fromCharCode(10)}เลือกช่องว่างเพื่อวาง X${String.fromCharCode(10)}${boardText}`)], components };
}

const winningLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(board: string[]) {
  const line = winningLines.find(([first, second, third]) => board[first] && board[first] === board[second] && board[first] === board[third]);
  return line ? board[line[0]] : null;
}

function botMove(board: string[]) {
  const choose = (mark: string) => winningLines
    .map((line) => ({ line, open: line.filter((index) => !board[index]), filled: line.filter((index) => board[index] === mark) }))
    .find((candidate) => candidate.open.length === 1 && candidate.filled.length === 2)?.open[0];
  const win = choose('O');
  if (win !== undefined) return win;
  const block = choose('X');
  if (block !== undefined) return block;
  if (!board[4]) return 4;
  const open = [0, 2, 6, 8, 1, 3, 5, 7].filter((index) => !board[index]);
  return open[Math.floor(Math.random() * open.length)];
}

function renderMines(state: GameState) {
  const revealed = new Set(state.revealed);
  const components = [0, 1, 2, 3].map((rowIndex) => row(...[0, 1, 2, 3].map((column) => {
    const index = rowIndex * 4 + column;
    return button(`minigame_mine:${index}`, revealed.has(index) ? '💎' : `${index + 1}`, ButtonStyle.Primary).setDisabled(revealed.has(index));
  })));
  const found = state.revealed?.length ?? 0;
  const progress = `${'💎'.repeat(found)}${'⬛'.repeat(5 - found)}`;
  return { embeds: [CafeEmbed.main('💣 หาทุ่นระเบิด', `เลือกช่องที่คิดว่าปลอดภัย เปิดให้เจอสมบัติ **5 ช่อง** โดยอย่าโดนระเบิด${String.fromCharCode(10)}ความคืบหน้า ${progress}${String.fromCharCode(10)}มีระเบิดซ่อนอยู่ 3 ลูก • ถ้าโดนจะจบรอบทันที`)], components };
}

async function beginGame(interaction: ButtonInteraction, game: string) {
  if (await loadState(interaction)) {
    await interaction.reply({ content: 'คุณมีเกมที่ยังเล่นไม่จบอยู่ครับ เล่นรอบนั้นให้จบก่อนนะ 🎮', ephemeral: true });
    return;
  }
  if (!(await checkCooldown(interaction))) return;
  if (game === 'xo' || game === 'mines') {
    const state: GameState = game === 'xo'
      ? { game, board: Array(9).fill(''), expiresAt: Date.now() + 10 * 60_000 }
      : { game, bombs: [...Array(16).keys()].sort(() => Math.random() - 0.5).slice(0, 3), revealed: [], expiresAt: Date.now() + 10 * 60_000 };
    await saveState(interaction, state);
    await interaction.update(game === 'xo' ? renderXo(state.board!) : renderMines(state));
    return;
  }
  if (game === 'rps') {
    await saveState(interaction, { game: 'rps', expiresAt: Date.now() + 10 * 60_000 });
    await interaction.update({
      embeds: [CafeEmbed.main('✊ เป่ายิ้งฉุบ', 'เลือกมือที่จะดวลกับ Maid ครับ')],
      components: [row(button('minigame_rps:rock', '✊ ค้อน'), button('minigame_rps:paper', '✋ กระดาษ'), button('minigame_rps:scissors', '✌️ กรรไกร'))],
    });
  }
}

async function finishGame(interaction: ButtonInteraction, state: GameState, title: string, description: string, amount: number, exp: number, badgeIds: string[] = []) {
  if (!(await consumeState(interaction, state))) {
    await interaction.reply({ content: 'รอบนี้จบไปแล้วครับ 🎮', ephemeral: true });
    return;
  }
  const reward = amount ? await grantReward(interaction, amount, exp, badgeIds) : 0;
  await interaction.update({
    embeds: [CafeEmbed.success(title, `${description}${amount ? `${String.fromCharCode(10)}${String.fromCharCode(10)}ได้รับ 💰 **${reward} ฿** และ ⭐ **${exp} EXP**` : ''}`)],
    components: [row(button('mini_game', 'เล่นอีกเกม', ButtonStyle.Primary))],
  });
}

export async function handleMinigameButton(interaction: ButtonInteraction) {
  const id = interaction.customId;
  if (id.startsWith('minigame_start:')) {
    await beginGame(interaction, id.split(':')[1]);
    return;
  }
  if (id.startsWith('minigame_rps:')) {
    const state = await loadState(interaction);
    if (!state || state.game !== 'rps') {
      await interaction.reply({ content: 'เกมนี้จบหรือหมดเวลาแล้วครับ', ephemeral: true });
      return;
    }
    const userChoice = id.split(':')[1];
    const options = ['rock', 'paper', 'scissors'];
    const botChoice = options[Math.floor(Math.random() * options.length)];
    const result = userChoice === botChoice ? 'draw'
      : (userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper') ? 'win' : 'lose';
    const labels: Record<string, string> = { rock: '✊ ค้อน', paper: '✋ กระดาษ', scissors: '✌️ กรรไกร' };
    await finishGame(interaction, state, result === 'win' ? 'ชนะแล้ว!' : result === 'draw' ? 'เสมอกัน!' : 'Maid ชนะรอบนี้', `คุณออก ${labels[userChoice]} • Maid ออก ${labels[botChoice]}${result === 'lose' ? `${String.fromCharCode(10)}ไม่เป็นไรครับ ไว้มาแก้มือกันใหม่` : ''}`, result === 'win' ? 100 : result === 'draw' ? 25 : 0, result === 'win' ? 15 : 5, result === 'win' ? ['minigame_win'] : []);
    return;
  }

  const state = await loadState(interaction);
  if (!state) {
    await interaction.reply({ content: 'เกมนี้จบหรือหมดเวลาแล้ว เริ่มรอบใหม่ได้ที่ปุ่มเล่นเกมครับ 🎮', ephemeral: true });
    return;
  }
  if (id.startsWith('minigame_xo:') && state.game === 'xo') {
    const previousState = { ...state };
    const index = Number(id.split(':')[1]);
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.board![index]) {
      await interaction.reply({ content: 'ช่องนี้เลือกไม่ได้แล้วครับ', ephemeral: true });
      return;
    }
    state.board![index] = 'X';
    if (winner(state.board!) === 'X') {
      await finishGame(interaction, state, 'ชนะ XO!', 'วาง X เรียงสามช่องก่อนบอตได้สำเร็จครับ', 180, 25, ['ttt_win', 'minigame_win']);
      return;
    }
    if (state.board!.every(Boolean)) {
      await finishGame(interaction, state, 'XO เสมอกัน', 'ไม่มีช่องว่างเหลือ ทั้งคู่เล่นได้สูสีมากครับ', 50, 10);
      return;
    }
    const move = botMove(state.board!);
    if (move !== undefined) state.board![move] = 'O';
    if (winner(state.board!) === 'O') {
      await finishGame(interaction, state, 'บอตชนะ XO', 'รอบนี้บอตเรียง O ได้ก่อน ลองวางแผนใหม่แล้วมาแก้มือครับ', 0, 0);
      return;
    }
    if (state.board!.every(Boolean)) {
      await finishGame(interaction, state, 'XO เสมอกัน', 'กระดานเต็มพอดี ทั้งคู่เล่นได้สูสีมากครับ', 50, 10);
      return;
    }
    if (!(await replaceState(interaction, previousState, state))) {
      await interaction.reply({ content: 'ตานี้ถูกเล่นไปแล้วครับ', ephemeral: true });
      return;
    }
    await interaction.update(renderXo(state.board!));
    return;
  }
  if (id.startsWith('minigame_mine:') && state.game === 'mines') {
    const previousState = { ...state };
    const index = Number(id.split(':')[1]);
    if (!Number.isInteger(index) || index < 0 || index > 15 || state.revealed!.includes(index)) {
      await interaction.reply({ content: 'ช่องนี้เลือกไม่ได้แล้วครับ', ephemeral: true });
      return;
    }
    if (state.bombs!.includes(index)) {
      await finishGame(interaction, state, 'เจอระเบิด!', 'ระเบิดอยู่ช่องนี้ครับ รอบหน้าลองเลือกช่องอื่นดูนะ 💣', 0, 0);
      return;
    }
    state.revealed!.push(index);
    if (state.revealed!.length >= 5) {
      await finishGame(interaction, state, 'เจอสมบัติครบแล้ว!', 'หลบทุ่นระเบิดและเปิดสมบัติครบ 5 ช่อง เก่งมากครับ', 160, 25, ['minefield_win', 'minigame_win']);
      return;
    }
    if (!(await replaceState(interaction, previousState, state))) {
      await interaction.reply({ content: 'ช่องนี้ถูกเปิดไปแล้วครับ', ephemeral: true });
      return;
    }
    await interaction.update(renderMines(state));
  }
}