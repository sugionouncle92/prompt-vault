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
  Eye,
  Maximize2,
} from 'lucide-react';
import { FolderItem, PromptItem } from '../types';

interface PromptCompactTableProps {
  prompts: PromptItem[];
  folders: FolderItem[];
  onSelectPrompt: (prompt: PromptItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onCopyPrompt: (text: string, e: React.MouseEvent, promptId?: string) => void;
  onEditPrompt: (prompt: PromptItem, e: React.MouseEvent) => void;
  onDuplicatePrompt: (prompt: PromptItem, e: React.MouseEvent) => void;
  onDeletePrompt: (id: string, e: React.MouseEvent) => void;
  onFillVariables: (prompt: PromptItem, e: React.MouseEvent) => void;
  onViewImageLightbox: (imageUrl: string, e: React.MouseEvent) => void;
  hideImageColumn?: boolean;
  hideFolderColumn?: boolean;
}

export const PromptCompactTable: React.FC<PromptCompactTableProps> = ({
  prompts,
  folders,
  onSelectPrompt,
  onToggleFavorite,
  onCopyPrompt,
  onEditPrompt,
  onDuplicatePrompt,
  onDeletePrompt,
  onFillVariables,
  onViewImageLightbox,
  hideImageColumn = false,
  hideFolderColumn = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (prompt: PromptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyPrompt(prompt.promptText, e, prompt.id);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800">
          <tr>
            <th className="py-3 px-4 w-10 text-center">Fav</th>
            {!hideImageColumn && <th className="py-3 px-4">Gambar</th>}
            <th className="py-3 px-4">Judul Prompt</th>
            <th className="py-3 px-4">Target AI</th>
            <th className="py-3 px-4">Kategori</th>
            {!hideFolderColumn && <th className="py-3 px-4">Folder</th>}
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {prompts.map((prompt) => {
            const folder = folders.find((f) => f.id === prompt.folderId);
            const isCopied = copiedId === prompt.id;
            const hasImage = prompt.images && prompt.images.length > 0;

            return (
              <tr
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt)}
                className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
              >
                {/* Favorite */}
                <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => onToggleFavorite(prompt.id, e)}
                    className="text-slate-500 hover:text-amber-400"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        prompt.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                  </button>
                </td>

                {/* Screenshot Image */}
                {!hideImageColumn && (
                  <td className="py-2.5 px-4">
                    {hasImage ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewImageLightbox(prompt.images[0], e);
                        }}
                        className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/60 group/img relative flex items-center justify-center p-0.5 cursor-zoom-in"
                        title="Lihat screenshot utuh"
                      >
                        <img
                          src={prompt.images[0]}
                          alt={prompt.title}
                          className="max-w-full max-h-full w-auto h-auto object-contain object-center group-hover/img:scale-110 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 italic text-[10px]">-</span>
                    )}
                  </td>
                )}

                {/* Title */}
                <td className="py-2.5 px-4 font-bold text-slate-100 group-hover:text-indigo-300 max-w-[180px] truncate">
                  {prompt.title}
                </td>

                {/* Target AI */}
                <td className="py-2.5 px-4">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {prompt.targetAI}
                  </span>
                </td>

                {/* Category */}
                <td className="py-2.5 px-4 text-slate-400 max-w-[120px] truncate">
                  {prompt.category}
                </td>

                {/* Folder */}
                {!hideFolderColumn && (
                  <td className="py-2.5 px-4">
                    {folder ? (
                      <span className={`folder-badge folder-badge-${folder.color || 'indigo'} inline-flex items-center gap-1 text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700`}>
                        <FolderIcon className="w-3 h-3 text-amber-400" />
                        <span className="truncate max-w-[90px]">{folder.name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 italic text-[10px]">-</span>
                    )}
                  </td>
                )}

                {/* Actions */}
                <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {prompt.variables && prompt.variables.length > 0 && (
                      <button
                        onClick={(e) => onFillVariables(prompt, e)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg"
                        title="Isi Variabel"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleCopy(prompt, e)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                      title="Salin Prompt"
                    >
                      {isCopied ? 'Tersalin' : 'Salin'}
                    </button>

                    <button
                      onClick={(e) => onEditPrompt(prompt, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => onDuplicatePrompt(prompt, e)}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg"
                      title="Duplikat"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => onDeletePrompt(prompt.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
