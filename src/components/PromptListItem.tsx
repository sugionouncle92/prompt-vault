import React, { useState } from 'react';
import {
  Star,
  Copy,
  Check,
  Edit,
  Trash2,
  CopyPlus,
  SlidersHorizontal,
  Folder as FolderIcon,
} from 'lucide-react';
import { FOLDER_COLORS, FolderItem, PromptItem } from '../types';

interface PromptListItemProps {
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

export const PromptListItem: React.FC<PromptListItemProps> = ({
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

  return (
    <div
      onClick={() => onSelectPrompt(prompt)}
      className="group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
      id={`prompt-list-${prompt.id}`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Screenshot Thumbnail (Image prompts only) */}
        {hasImages && !hideImage && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewImageLightbox(prompt.images[0], e);
            }}
            className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-950 border border-slate-700/60 group/thumb flex items-center justify-center p-1 cursor-zoom-in"
            title="Klik untuk melihat screenshot utuh"
          >
            <img
              src={prompt.images[0]}
              alt={prompt.title}
              className="max-w-full max-h-full w-auto h-auto object-contain object-center group-hover/thumb:scale-105 transition-transform rounded"
            />
            {prompt.images.length > 1 && (
              <span className="absolute bottom-1 right-1 text-[9px] bg-slate-950/90 text-slate-200 font-bold px-1 rounded border border-slate-700/50">
                +{prompt.images.length - 1}
              </span>
            )}
          </div>
        )}

        {/* Info */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
              {prompt.title}
            </h3>

            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {prompt.targetAI}
            </span>

            {!hideFolderBadge && folder && folderColor && (
              <span
                className={`folder-badge folder-badge-${folder.color || 'indigo'} text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 ${folderColor.lightBg} ${folderColor.text} ${folderColor.border}`}
              >
                <FolderIcon className="w-3 h-3" />
                <span>{folder.name}</span>
              </span>
            )}
          </div>

          {/* Tags */}
          {prompt.tags && prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prompt.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
        <button
          onClick={(e) => onToggleFavorite(prompt.id, e)}
          className="p-2 text-slate-400 hover:text-amber-400 transition-colors"
          title="Favorit"
        >
          <Star
            className={`w-4 h-4 ${
              prompt.isFavorite ? 'text-amber-400 fill-amber-400' : ''
            }`}
          />
        </button>

        {prompt.variables && prompt.variables.length > 0 && (
          <button
            onClick={(e) => onFillVariables(prompt, e)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium flex items-center gap-1"
            title="Isi Variabel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Isi Variabel</span>
          </button>
        )}

        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            copied
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
          title="Salin Prompt"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Tersalin' : 'Salin'}</span>
        </button>

        <button
          onClick={(e) => onEditPrompt(prompt, e)}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          title="Edit"
        >
          <Edit className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => onDuplicatePrompt(prompt, e)}
          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg"
          title="Duplikat"
        >
          <CopyPlus className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => onDeletePrompt(prompt.id, e)}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
          title="Hapus"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
