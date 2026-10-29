export interface TagItem {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  createdAt: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  updatedAt: string;
  title: string;
  promptText: string;
  changeNote?: string;
}

export interface PromptItem {
  id: string;
  title: string;
  promptText: string;
  description?: string;
  targetAI: string; // e.g. "ChatGPT", "Midjourney", "Claude", "Gemini", "DALL-E 3", "Stable Diffusion", "DeepSeek", "GitHub Copilot", "Custom"
  category: string; // e.g. "Coding & Tech", "Design & Art", "Marketing & Copywriting", "Content & Writing", "Productivity", "Custom"
  folderId?: string | null;
  tags: string[];
  images: string[]; // Data URLs or HTTP URLs
  isFavorite: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  versionHistory: PromptVersion[];
  variables?: string[]; // e.g. ["topic", "audience", "language"]
  usageCount?: number;
  lastUsedAt?: string; // ISO date string
}

export interface FolderItem {
  id: string;
  name: string;
  color: string; // Tailwind color name e.g. "indigo", "emerald", "amber", "rose", "cyan", "purple"
  icon?: string;
  description?: string;
  createdAt: string;
  isLocked?: boolean;
  keyHash?: string; // PBKDF2 hash of the key
  keySalt?: string; // Salt used for hashing
  lockType?: 'key';
}

export type ViewMode = 'grid' | 'list' | 'compact';

export type AppTheme = 'dark' | 'light';

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'title'
  | 'favorites'
  | 'most_used'
  | 'last_used';

export interface FilterState {
  searchQuery: string;
  category: string; // 'all' or category name
  folderId: string; // 'all', 'unorganized', or folder id
  targetAI: string; // 'all' or target AI name
  tag: string; // 'all' or tag name
  onlyFavorites: boolean;
  contentType?: 'all' | 'image' | 'text';
  sortBy: SortOption;
  viewMode: ViewMode;
}

export const DEFAULT_TARGET_AI = 'Gemini';

export const TARGET_AI_OPTIONS = [
  'Gemini',
  'ChatGPT',
  'Claude',
  'Midjourney',
  'DALL-E 3',
  'Stable Diffusion',
  'DeepSeek',
  'GitHub Copilot',
  'Perplexity',
  'Llama',
  'Luma Dream Machine',
  'Custom AI',
];

export const CATEGORY_OPTIONS: string[] = [];

export const FOLDER_COLORS = [
  {
    name: 'Indigo',
    value: 'indigo',
    bg: 'bg-indigo-500',
    text: 'text-indigo-400',
    border: 'border-indigo-500/40',
    activeBg: 'bg-indigo-950/70 border-indigo-500/50 text-slate-100',
    badgeBg: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/60',
    lightBg: 'bg-indigo-950/60 border-indigo-500/40',
  },
  {
    name: 'Emerald',
    value: 'emerald',
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    activeBg: 'bg-emerald-950/70 border-emerald-500/50 text-slate-100',
    badgeBg: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60',
    lightBg: 'bg-emerald-950/60 border-emerald-500/40',
  },
  {
    name: 'Amber',
    value: 'amber',
    bg: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    activeBg: 'bg-amber-950/70 border-amber-500/50 text-slate-100',
    badgeBg: 'bg-amber-900/60 text-amber-200 border-amber-700/60',
    lightBg: 'bg-amber-950/60 border-amber-500/40',
  },
  {
    name: 'Rose',
    value: 'rose',
    bg: 'bg-rose-500',
    text: 'text-rose-400',
    border: 'border-rose-500/40',
    activeBg: 'bg-rose-950/70 border-rose-500/50 text-slate-100',
    badgeBg: 'bg-rose-900/60 text-rose-200 border-rose-700/60',
    lightBg: 'bg-rose-950/60 border-rose-500/40',
  },
  {
    name: 'Cyan',
    value: 'cyan',
    bg: 'bg-cyan-500',
    text: 'text-cyan-400',
    border: 'border-cyan-500/40',
    activeBg: 'bg-cyan-950/70 border-cyan-500/50 text-slate-100',
    badgeBg: 'bg-cyan-900/60 text-cyan-200 border-cyan-700/60',
    lightBg: 'bg-cyan-950/60 border-cyan-500/40',
  },
  {
    name: 'Purple',
    value: 'purple',
    bg: 'bg-purple-500',
    text: 'text-purple-400',
    border: 'border-purple-500/40',
    activeBg: 'bg-purple-950/70 border-purple-500/50 text-slate-100',
    badgeBg: 'bg-purple-900/60 text-purple-200 border-purple-700/60',
    lightBg: 'bg-purple-950/60 border-purple-500/40',
  },
  {
    name: 'Blue',
    value: 'blue',
    bg: 'bg-blue-500',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    activeBg: 'bg-blue-950/70 border-blue-500/50 text-slate-100',
    badgeBg: 'bg-blue-900/60 text-blue-200 border-blue-700/60',
    lightBg: 'bg-blue-950/60 border-blue-500/40',
  },
];
