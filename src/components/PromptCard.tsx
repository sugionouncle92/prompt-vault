import React, { useState } from 'react';
import {
  Star,
  Copy,
  Check,
  MoreVertical,
  SlidersHorizontal,
  History,
  Trash2,
  Edit,
  CopyPlus,
  Eye,
  Folder as FolderIcon,
  Tag,
  Maximize2,
} from 'lucide-react';
import { FOLDER_COLORS, FolderItem, PromptItem } from '../types';

interface PromptCardProps {
  prompt: PromptItem;
  folders: FolderItem[];
  onSelectPrompt: (prompt: PromptItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onCopyPrompt: (text: string, e: React.MouseEvent, promptId?: string) => void;
  onEditPrompt: (prompt: PromptItem, e: React.MouseEvent) => void;
  onDuplicatePrompt: (prompt: PromptItem, e: React.MouseEvent) => void;
  onDeletePrompt: (id: string, e: React.MouseEvent) => void;
  onFillVariables: (prompt: PromptItem, e: React.MouseEvent) => void;
  onViewImageLightbox: (imageUrl: string, e: React.MouseEvent) => void;
  hideImage?: boolean;
  hideFolderBadge?: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  folders,
  onSelectPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onEditPrompt,
  onDuplicatePrompt,
  onDeletePrompt,
  onFillVariables,
  onViewImageLightbox,
  hideImage = false,
  hideFolderBadge = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const folder = folders.find((f) => f.id === prompt.folderId);
  const folderColor =
    folder ? FOLDER_COLORS.find((c) => c.value === folder.color) : null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyPrompt(prompt.promptText, e, prompt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasImages = prompt.images && prompt.images.length > 0;
  const isTextCard = hideImage || !hasImages;
  const currentImage = hasImages ? prompt.images[activeImageIndex] : null;

  // Target AI color badge styling
  const getAIBadgeColor = (aiName: string) => {
    switch (aiName) {
      case 'ChatGPT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Midjourney':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Claude':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Gemini':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DALL-E 3':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'Stable Diffusion':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    }
  };

  // 1. Text-Only Prompt Card Layout (Compact, No Image Thumbnail or Placeholder)
  if (isTextCard) {
    return (
      <div
        onClick={() => onSelectPrompt(prompt)}
        className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer select-none"
        id={`prompt-card-${prompt.id}`}
      >
        <div className="p-4 space-y-3">
          {/* Baris 1: Badge Model AI & Ikon Favorit */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg border backdrop-blur-md shadow-sm ${getAIBadgeColor(
                prompt.targetAI
              )}`}
            >
              {prompt.targetAI}
            </span>

            {/* Favorite button */}
            <button
              onClick={(e) => onToggleFavorite(prompt.id, e)}
              className="w-8 h-8 -mr-1.5 -mt-1.5 flex items-center justify-center text-slate-400 hover:text-amber-400 active:scale-95 transition-all shrink-0 rounded-xl"
              title={prompt.isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
              aria-label={prompt.isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            >
              <Star
                className={`w-4 h-4 ${
                  prompt.isFavorite
                    ? 'text-amber-400 fill-amber-400'
                    : 'hover:fill-amber-400/20'
                }`}
              />
            </button>
          </div>

          {/* Baris 2: Judul Prompt */}
          <h3 className="text-[15px] sm:text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
            {prompt.title}
          </h3>

          {/* Baris 3: Informasi Folder & Jumlah Karakter */}
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-400 pt-0.5">
            {!hideFolderBadge && (
              <div className="flex items-center gap-1.5 min-w-0">
                {folder && folderColor ? (
                  <span
                    className={`folder-badge folder-badge-${folder.color || 'indigo'} text-[11px] font-medium px-2 py-0.5 rounded-lg border flex items-center gap-1 ${folderColor.lightBg} ${folderColor.text} ${folderColor.border} max-w-[150px] truncate`}
                  >
                    <FolderIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                    {prompt.category || 'Umum'}
                  </span>
                )}
              </div>
            )}

            {/* Character Count Indicator */}
            <span className="text-[11px] text-slate-400 font-mono shrink-0">
              {prompt.promptText.length} karakter
            </span>
          </div>

          {/* Tags (if available) */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {prompt.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50"
                >
                  #{tag}
                </span>
              ))}
              {prompt.tags.length > 3 && (
                <span className="text-[10px] text-slate-500 py-0.5">
                  +{prompt.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Baris 4: Area Tindakan (Salin, Isi Variabel jika tersedia, dan Menu Tiga Titik) */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
          <div className="flex items-center gap-2">
            {/* Quick Copy Button */}
            <button
              onClick={handleCopy}
              className={`min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
              }`}
              title="Salin Prompt"
              id={`copy-btn-${prompt.id}`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin</span>
                </>
              )}
            </button>

            {/* Fill Variables Button (if variables exist) */}
            {prompt.variables && prompt.variables.length > 0 && (
              <button
                onClick={(e) => onFillVariables(prompt, e)}
                className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Isi Variabel Prompt"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Isi Variabel</span>
              </button>
            )}
          </div>

          {/* Action Menu Trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 rounded-xl transition-colors shrink-0"
              title="Opsi Lainnya"
              aria-label="Menu Opsi Prompt"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Menu Dropdown */}
            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1.5 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 z-20 text-xs text-slate-200 backdrop-blur-md"
              >
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onSelectPrompt(prompt);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lihat Detail</span>
                </button>
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onEditPrompt(prompt, e);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Prompt</span>
                </button>
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onDuplicatePrompt(prompt, e);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Duplikat</span>
                </button>
                <div className="my-1 border-t border-slate-700" />
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onDeletePrompt(prompt.id, e);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-500/20 text-rose-300 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Prompt</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Image Prompt Card Layout (with Screenshot Thumbnail Header)
  return (
    <div
      onClick={() => onSelectPrompt(prompt)}
      className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer h-full select-none"
      id={`prompt-card-${prompt.id}`}
    >
      <div>
        {/* Screenshot / Image Header Section */}
        {hasImages ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewImageLightbox(currentImage!, e);
            }}
            className="relative w-full h-48 sm:h-52 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80 p-2 group/img cursor-zoom-in"
            title="Klik untuk membuka preview gambar utuh"
          >
            <img
              src={currentImage!}
              alt={prompt.title}
              className="max-w-full max-h-full w-auto h-auto object-contain object-center rounded-lg transition-transform duration-300 group-hover/img:scale-[1.02] drop-shadow-md select-none"
              loading="lazy"
            />

            {/* Quick Full Image Zoom Overlay Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewImageLightbox(currentImage!, e);
              }}
              className="absolute top-2.5 right-2.5 p-2 bg-slate-900/90 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl backdrop-blur-md transition-all shadow-lg border border-slate-700/60 opacity-0 group-hover/img:opacity-100 z-10"
              title="Perbesar Screenshot (Full Lightbox)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Multi-Image Dots / Indicators */}
            {prompt.images.length > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700/70 shadow-lg z-10"
              >
                {prompt.images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(idx);
                    }}
                    className={`h-2 rounded-full transition-all ${
                      idx === activeImageIndex
                        ? 'bg-indigo-400 w-4'
                        : 'bg-slate-600 hover:bg-slate-400 w-2'
                    }`}
                    title={`Lihat gambar ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Category / Target AI Badges over image */}
            <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border backdrop-blur-md shadow-md ${getAIBadgeColor(
                  prompt.targetAI
                )}`}
              >
                {prompt.targetAI}
              </span>
            </div>
          </div>
        ) : null}

        {/* Content Body: Clean Information Area (No Prompt Text Preview) */}
        <div className="p-3.5 sm:p-4 space-y-2.5">
          {/* Header Title & Favorite Toggle */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] sm:text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
              {prompt.title}
            </h3>

            {/* Favorite button with min 44x44px touch target on mobile */}
            <button
              onClick={(e) => onToggleFavorite(prompt.id, e)}
              className="w-10 h-10 -mr-1.5 -mt-1.5 flex items-center justify-center text-slate-400 hover:text-amber-400 active:scale-95 transition-all shrink-0 rounded-xl"
              title={prompt.isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
              aria-label={prompt.isFavorite ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
            >
              <Star
                className={`w-5 h-5 ${
                  prompt.isFavorite
                    ? 'text-amber-400 fill-amber-400'
                    : 'hover:fill-amber-400/20'
                }`}
              />
            </button>
          </div>

          {/* Metadata Row: Folder & Character Count Indicator */}
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-400 pt-0.5">
            {!hideFolderBadge && (
              <div className="flex items-center gap-1.5 min-w-0">
                {folder && folderColor ? (
                  <span
                    className={`folder-badge folder-badge-${folder.color || 'indigo'} text-[11px] font-medium px-2 py-0.5 rounded-lg border flex items-center gap-1 ${folderColor.lightBg} ${folderColor.text} ${folderColor.border} max-w-[150px] truncate`}
                  >
                    <FolderIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                    {prompt.category || 'Umum'}
                  </span>
                )}
              </div>
            )}

            {/* Character Count Indicator */}
            <span className="text-[11px] text-slate-400 font-mono shrink-0">
              {prompt.promptText.length} karakter
            </span>
          </div>

          {/* Tags (if available) */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {prompt.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50"
                >
                  #{tag}
                </span>
              ))}
              {prompt.tags.length > 3 && (
                <span className="text-[10px] text-slate-500 py-0.5">
                  +{prompt.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Quick Copy Button with 40-44px touch height */}
          <button
            onClick={handleCopy}
            className={`min-h-[40px] sm:min-h-[38px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
            }`}
            title="Salin Prompt"
            id={`copy-btn-${prompt.id}`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin</span>
              </>
            )}
          </button>

          {/* Fill Variables Button (if variables exist) */}
          {prompt.variables && prompt.variables.length > 0 && (
            <button
              onClick={(e) => onFillVariables(prompt, e)}
              className="min-h-[40px] sm:min-h-[38px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Isi Variabel Prompt"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Isi Variabel</span>
            </button>
          )}
        </div>

        {/* Action Menu Trigger with 44x44px touch area */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 rounded-xl transition-colors shrink-0"
            title="Opsi Lainnya"
            aria-label="Menu Opsi Prompt"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Context Menu Dropdown */}
          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full mb-1.5 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 z-20 text-xs text-slate-200 backdrop-blur-md"
            >
              <button
                onClick={(e) => {
                  setShowMenu(false);
                  onSelectPrompt(prompt);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lihat Detail</span>
              </button>
              <button
                onClick={(e) => {
                  setShowMenu(false);
                  onEditPrompt(prompt, e);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
              >
                <Edit className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit Prompt</span>
              </button>
              <button
                onClick={(e) => {
                  setShowMenu(false);
                  onDuplicatePrompt(prompt, e);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
              >
                <CopyPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Duplikat</span>
              </button>
              <div className="my-1 border-t border-slate-700" />
              <button
                onClick={(e) => {
                  setShowMenu(false);
                  onDeletePrompt(prompt.id, e);
                }}
                className="w-full text-left px-3 py-2 hover:bg-rose-500/20 text-rose-300 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Prompt</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
