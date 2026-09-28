import { CommandInteraction, ButtonInteraction, SelectMenuInteraction } from 'discord.js';

export type CommandHandler = {
  name: string;
  description: string;
  options?: any[];
  execute: (interaction: CommandInteraction) => Promise<void>;
};

export type EventHandler = {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void>;
};

export type InteractionType = CommandInteraction | ButtonInteraction | SelectMenuInteraction;

export interface CafeConfig {
  currencySymbol: string;
  dailyReward: number;
  workCooldownSeconds: number;
  questCooldownSeconds: number;
}

export interface UserEconomyData {
  money: number;
  level: number;
  exp: number;
  friendshipLevel: number;
  ordersCompleted: number;
}

export interface MaidResponse {
  text: string;
  emoji: string;
}