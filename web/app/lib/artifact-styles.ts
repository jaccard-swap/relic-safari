// Artifact styling utilities based on traits

export const RARITY_STYLES: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  common: { bg: "bg-stone-700/50", border: "border-stone-600", text: "text-stone-300" },
  uncommon: { bg: "bg-emerald-900/40", border: "border-emerald-700", text: "text-emerald-300" },
  rare: { bg: "bg-sky-900/40", border: "border-sky-600", text: "text-sky-300" },
  epic: { bg: "bg-violet-900/40", border: "border-violet-500", text: "text-violet-300" },
  legendary: {
    bg: "bg-amber-900/50",
    border: "border-amber-500 border-2",
    text: "text-amber-300 font-bold",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.5)]",
  },
};

export const QUALITY_BADGE: Record<string, string> = {
  fragmented: "text-stone-500",
  worn: "text-stone-400",
  intact: "text-stone-300",
  pristine: "text-emerald-400",
  immaculate: "text-amber-300 font-medium",
};

export const INSCRIPTION_STYLES: Record<string, string> = {
  unmarked: "text-white/40",
  faded: "text-white/50 italic",
  partial: "text-white/70",
  legible: "text-amber-200",
  glowing: "text-amber-300 animate-pulse drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]",
};

export const AGE_STYLES: Record<string, { emoji: string; style: string }> = {
  "neolithic age": { emoji: "🦴", style: "text-stone-400" },
  "bronze age": { emoji: "🏺", style: "text-amber-700" },
  "iron age": { emoji: "⚔️", style: "text-slate-400" },
  "classical era": { emoji: "🏛️", style: "text-sky-300" },
  "medieval era": { emoji: "🏰", style: "text-stone-300" },
  antediluvian: { emoji: "🌊", style: "text-violet-400 italic" },
};

export const MATERIAL_STYLES: Record<string, { emoji: string; style: string }> = {
  clay: { emoji: "🧱", style: "text-orange-300/70" },
  bone: { emoji: "🦴", style: "text-stone-200" },
  bronze: { emoji: "🥉", style: "text-amber-600" },
  iron: { emoji: "⚙️", style: "text-slate-400" },
  silver: { emoji: "🥈", style: "text-slate-200" },
  jade: { emoji: "💚", style: "text-emerald-400" },
  obsidian: { emoji: "🖤", style: "text-violet-300" },
  gold: { emoji: "🥇", style: "text-yellow-400" },
  orichalcum: { emoji: "✨", style: "text-rose-300 animate-pulse" },
};

export const SITE_STYLES: Record<string, { emoji: string; style: string }> = {
  "sunken-temple": { emoji: "🌊", style: "text-cyan-400" },
  "desert-tomb": { emoji: "🏜️", style: "text-amber-400" },
  "mountain-shrine": { emoji: "⛰️", style: "text-slate-300" },
  "forest-barrow": { emoji: "🌲", style: "text-emerald-400" },
  "volcanic-forge": { emoji: "🌋", style: "text-orange-500" },
  "frozen-citadel": { emoji: "❄️", style: "text-cyan-200" },
  "frozen-vault": { emoji: "❄️", style: "text-cyan-200" },
  "coastal-ruins": { emoji: "🐚", style: "text-teal-300" },
};

export const RARITY_EMOJI: Record<string, string> = {
  common: "⚪",
  uncommon: "🟢",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟠",
};

export const QUALITY_EMOJI: Record<string, string> = {
  fragmented: "💔",
  worn: "🩹",
  intact: "✅",
  pristine: "💎",
  immaculate: "⭐",
};

export const INSCRIPTION_EMOJI: Record<string, string> = {
  unmarked: "",
  faded: "📝",
  partial: "📜",
  legible: "📖",
  glowing: "✨",
};

export const FORM_EMOJI: Record<string, string> = {
  tablet: "📜",
  idol: "🗿",
  vessel: "🏺",
  amulet: "📿",
  blade: "🗡️",
  scepter: "👑",
  mask: "🎭",
};

// Emoji per trait *key* (rarity, age, ...) - distinct from the per-*value*
// maps above (RARITY_EMOJI etc.), used wherever a trait is labeled generically
// rather than rendering one specific value (e.g. the standing-bid trait picker).
export const TRAIT_KEY_EMOJI: Record<string, string> = {
  rarity: "💎",
  age: "📜",
  quality: "✨",
  material: "🪨",
  form: "⚱️",
  site: "🏛️",
  inscription: "✍️",
};

export function getCardStyles(rarity: string = "common"): string {
  const style = RARITY_STYLES[rarity] || RARITY_STYLES.common;
  return `${style.bg} ${style.border} ${style.glow || ""}`;
}

export function getNameStyles(rarity: string = "common"): string {
  const style = RARITY_STYLES[rarity] || RARITY_STYLES.common;
  return style.text;
}
