import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Plus,
  Trash2,
  SlidersHorizontal,
  Folder as FolderIcon,
  Bot,
  Tag as TagIcon,
  ImageIcon,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import {
  FolderItem,
  PromptItem,
  TagItem,
  TARGET_AI_OPTIONS,
} from '../types';
import { extractVariablesFromPrompt, fileToBase64, sortFoldersByName, getStoredTags } from '../utils/storage';

interface PromptFormModalProps {
  initialPrompt?: PromptItem | null;
  folders: FolderItem[];
  prompts?: PromptItem[];
  tagsList?: TagItem[];
  onCreateTag?: (tagName: string) => TagItem;
  defaultFolderId?: string | null;
  onClose: () => void;
  onSave: (promptData: Partial<PromptItem>, changeNote?: string) => void;
}

const PRESET_SAMPLE_IMAGES = [
  {
    name: 'Futuristic Portrait',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop',
  },
  {
    name: 'Code Editor',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop',
  },
  {
    name: 'Landing Page UI',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format&fit=crop',
  },
  {
    name: 'Vector Abstract Logo',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
  },
  {
    name: 'Business Analytics',
    url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop',
  },
];

export const PromptFormModal: React.FC<PromptFormModalProps> = ({
  initialPrompt,
  folders,
  prompts = [],
  tagsList = [],
  onCreateTag,
  defaultFolderId = null,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialPrompt);

  // If editing, preserve the prompt's existing folder; if creating new, auto-select active folder if valid
  const initialFolderId = isEditing
    ? initialPrompt?.folderId || null
    : (defaultFolderId && folders.some((f) => f.id === defaultFolderId) ? defaultFolderId : null);

  const [title, setTitle] = useState(initialPrompt?.title || '');
  const [promptText, setPromptText] = useState(initialPrompt?.promptText || '');
  const [targetAI, setTargetAI] = useState(initialPrompt?.targetAI || TARGET_AI_OPTIONS[0]);
  const [category, setCategory] = useState(initialPrompt?.category || '');
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);

  // Active tags calculation: from props or stored fallback, filtered and sorted alphabetically
  const allTags = tagsList && tagsList.length > 0 ? tagsList : getStoredTags(prompts);
  const activeTags = allTags
    .filter((t) => t.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const [selectedActiveTag, setSelectedActiveTag] = useState('');
  const [description, setDescription] = useState(initialPrompt?.description || '');
  const [tags, setTags] = useState<string[]>(initialPrompt?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isTagSuggestOpen, setIsTagSuggestOpen] = useState(false);
  const tagSuggestContainerRef = useRef<HTMLDivElement>(null);

  const [images, setImages] = useState<string[]>(initialPrompt?.images || []);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [showPresetImages, setShowPresetImages] = useState(false);
  const [formMode, setFormMode] = useState<'text-only' | 'with-images'>(
    initialPrompt && initialPrompt.images && initialPrompt.images.length > 0
      ? 'with-images'
      : 'text-only'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto detect variables
  const detectedVariables = extractVariablesFromPrompt(promptText);

  // Close tag suggestions popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagSuggestContainerRef.current &&
        !tagSuggestContainerRef.current.contains(e.target as Node)
      ) {
        setIsTagSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handler saat memilih dari dropdown 'Tag Aktif'
  const handleSelectActiveTag = (chosenTagName: string) => {
    if (!chosenTagName) return;
    const exists = tags.some((t) => t.toLowerCase() === chosenTagName.toLowerCase());
    if (!exists) {
      setTags((prev) => [...prev, chosenTagName]);
    }
    setCategory(chosenTagName);
    setSelectedActiveTag(''); // Reset to placeholder so user can select another if needed
  };

  // Tag Handling & Autocomplete Logic
  const cleanedTagInput = tagInput.trim().replace(/^#/, '');
  const normalizedTagQuery = cleanedTagInput.toLowerCase();

  // Find tags that match query and aren't already added to this prompt
  const filteredActiveTags = activeTags.filter((t) => {
    const isAlreadyAdded = tags.some((selected) => selected.toLowerCase() === t.normalizedName);
    if (isAlreadyAdded) return false;
    if (!cleanedTagInput) return true; // Show all available active tags when input is focused
    return t.normalizedName.includes(normalizedTagQuery);
  });

  // Check if query matches an existing active tag exactly
  const exactMatchTag = activeTags.find((t) => t.normalizedName === normalizedTagQuery);
  const canCreateNew = cleanedTagInput.length > 0 && !exactMatchTag;

  // Memilih tag yang sudah ada
  const handleSelectExistingTag = (tagName: string) => {
    const exists = tags.some((t) => t.toLowerCase() === tagName.toLowerCase());
    if (!exists) {
      setTags((prev) => [...prev, tagName]);
    }
    setTagInput('');
    setIsTagSuggestOpen(false);
  };

  // Membuat tag baru lalu otomatis menambahkannya ke prompt saat ini
  const handleCreateAndSelectTag = (rawName: string) => {
    const clean = rawName.trim().replace(/^#/, '');
    if (!clean) return;

    let targetName = clean;
    if (onCreateTag) {
      const created = onCreateTag(clean);
      targetName = created.name;
    }

    const exists = tags.some((t) => t.toLowerCase() === targetName.toLowerCase());
    if (!exists) {
      setTags((prev) => [...prev, targetName]);
    }
    setTagInput('');
    setIsTagSuggestOpen(false);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (!cleanedTagInput) return;

      if (exactMatchTag) {
        handleSelectExistingTag(exactMatchTag.name);
      } else if (canCreateNew) {
        handleCreateAndSelectTag(cleanedTagInput);
      } else if (filteredActiveTags.length > 0) {
        handleSelectExistingTag(filteredActiveTags[0].name);
      }
    } else if (e.key === 'Escape') {
      setIsTagSuggestOpen(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Image Upload Handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = await fileToBase64(files[i]);
        setImages((prev) => [...prev, base64]);
      } catch (err) {
        console.error('Error uploading image file:', err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (url) {
      setImages((prev) => [...prev, url]);
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptText.trim()) return;

    const finalImages = formMode === 'text-only' ? [] : images;
    const finalCategory = (tags.length > 0 ? tags[0] : (category.trim() || initialPrompt?.category || 'Umum'));

    onSave(
      {
        title: title.trim(),
        promptText: promptText.trim(),
        targetAI,
        category: finalCategory,
        folderId,
        description: description.trim(),
        tags,
        images: finalImages,
        variables: detectedVariables,
      },
      isEditing ? changeNote.trim() : 'Inisialisasi prompt'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>{isEditing ? 'Edit Prompt' : 'Tambah Prompt Baru'}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
          {/* Mode Pembuatan Prompt: Segmented Control */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Pilihan Mode Pembuatan</label>
            <div
              id="prompt-form-mode-container"
              className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800 rounded-2xl gap-1"
            >
              <button
                type="button"
                onClick={() => setFormMode('text-only')}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all select-none ${
                  formMode === 'text-only'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                id="form-mode-text-only-btn"
              >
                <span className="text-sm">📝</span>
                <span>Teks Saja</span>
              </button>
              <button
                type="button"
                onClick={() => setFormMode('with-images')}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all select-none ${
                  formMode === 'with-images'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                id="form-mode-with-images-btn"
              >
                <span className="text-sm">🖼️</span>
                <span>Dengan Referensi Gambar</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Judul Prompt <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Senior React & TypeScript Code Reviewer..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
              id="prompt-title-input"
            />
          </div>

          {/* Grid: Target AI & Category & Folder */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Target AI */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Target Model AI
              </label>
              <select
                value={targetAI}
                onChange={(e) => setTargetAI(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none"
                id="prompt-target-ai-select"
              >
                {TARGET_AI_OPTIONS.map((ai) => (
                  <option key={ai} value={ai}>
                    {ai}
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Aktif (Menggantikan Kategori Custom) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Tag Aktif</label>
              <select
                value={selectedActiveTag}
                onChange={(e) => handleSelectActiveTag(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors"
                id="prompt-active-tag-select"
              >
                <option value="">
                  {activeTags.length === 0 ? '(Belum ada tag aktif)' : '(Pilih Tag Aktif)'}
                </option>
                {activeTags.map((t) => (
                  <option key={t.id} value={t.name}>
                    🏷️ {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Folder */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Folder Penyimpanan</label>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none"
                id="prompt-folder-select"
              >
                <option value="">(Tanpa Folder)</option>
                {sortFoldersByName(folders).map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prompt Text Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Teks Prompt AI <span className="text-rose-400">*</span>
              </label>

              {detectedVariables.length > 0 && (
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  {detectedVariables.length} variabel terdeteksi: [{detectedVariables.join(', ')}]
                </span>
              )}
            </div>

            <textarea
              required
              rows={6}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Tuliskan prompt AI lengkap di sini. Gunakan kurung siku [nama_variabel] untuk parameter dinamis..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs font-mono rounded-xl p-3.5 outline-none leading-relaxed transition-all"
              id="prompt-text-input"
            />
          </div>

          {/* Description & Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Deskripsi & Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan singkat cara penggunaan atau konteks prompt..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 outline-none"
            />
          </div>

          {/* Screenshots & Images Uploader Section (Hanya tampil di Mode 'Dengan Referensi Gambar') */}
          {formMode === 'with-images' && (
            <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  <span>Screenshot & Referensi Gambar ({images.length})</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowPresetImages(!showPresetImages)}
                  className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {showPresetImages ? 'Sembunyikan Pustaka Preset' : '+ Pilih dari Sample Preset'}
                </button>
              </div>

              {/* Sample Preset Library */}
              {showPresetImages && (
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <p className="text-[11px] text-slate-400">
                    Klik gambar preset di bawah untuk menambahkannya langsung ke prompt ini:
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_SAMPLE_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImages((prev) => [...prev, preset.url])}
                        className="group relative h-16 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all"
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-indigo-600/30 flex items-center justify-center transition-colors">
                          <Plus className="w-4 h-4 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Upload File Gambar</span>
                </button>

                <span className="text-slate-500 text-xs hidden sm:inline">atau</span>

                {/* URL Input */}
                <div className="flex-1 flex items-center gap-1 w-full">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Tempelkan URL gambar (https://...)"
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3 py-2 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shrink-0"
                  >
                    Tambah URL
                  </button>
                </div>
              </div>

              {/* Thumbnail Preview Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 pt-2">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-700/80 flex items-center justify-center p-1"
                    >
                      <img
                        src={img}
                        alt="Preview"
                        className="max-w-full max-h-full w-auto h-auto object-contain object-center rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        title="Hapus Gambar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags Chip Input dengan Pilih & Buat Tag Baru */}
          <div className="space-y-1.5 relative" ref={tagSuggestContainerRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tag & Kata Kunci</span>
              </label>
              {tags.length > 0 && (
                <span className="text-[11px] text-slate-400 font-medium">
                  {tags.length} tag terpilih
                </span>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-slate-800 focus-within:border-indigo-500 rounded-xl p-2.5 min-h-[44px] cursor-text transition-all"
              onClick={() => setIsTagSuggestOpen(true)}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-slate-800 text-emerald-300 font-mono px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 select-none shadow-sm"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag);
                    }}
                    className="hover:text-rose-400 transition-colors p-0.5 rounded leading-none"
                    title={`Hapus tag #${tag} dari prompt ini`}
                  >
                    ✕
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setIsTagSuggestOpen(true);
                }}
                onFocus={() => setIsTagSuggestOpen(true)}
                onKeyDown={handleTagInputKeyDown}
                placeholder={
                  tags.length === 0
                    ? 'Ketik untuk cari tag atau buat baru...'
                    : 'Tambah tag lain...'
                }
                className="flex-1 bg-transparent text-slate-100 text-xs outline-none min-w-[140px]"
                id="prompt-tag-input"
              />
            </div>

            {/* Dropdown Auto-Suggest: Pilih Tag Aktif atau Buat Tag Baru */}
            {isTagSuggestOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
                id="tag-autocomplete-dropdown"
              >
                {/* Opsi Buat Tag Baru jika query belum ada di tag aktif */}
                {canCreateNew && (
                  <button
                    type="button"
                    onClick={() => handleCreateAndSelectTag(cleanedTagInput)}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-indigo-400 hover:text-white bg-indigo-950/40 hover:bg-indigo-600 border-b border-slate-800 flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" />
                      <span>
                        + Buat tag baru: <strong className="underline underline-offset-2">"{cleanedTagInput}"</strong>
                      </span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 group-hover:bg-white/20 text-indigo-200 group-hover:text-white">
                      Enter
                    </span>
                  </button>
                )}

                {/* List Tag Aktif yang cocok */}
                {filteredActiveTags.length > 0 ? (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Pilih dari Tag Aktif ({filteredActiveTags.length})
                    </div>
                    {filteredActiveTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectExistingTag(t.name)}
                        className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:text-white hover:bg-indigo-600/30 flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-emerald-400 font-mono text-xs">#</span>
                          <span className="font-medium group-hover:text-white">{t.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 group-hover:text-slate-300">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  !canCreateNew && (
                    <div className="p-3.5 text-center text-xs text-slate-400">
                      {activeTags.length === 0
                        ? 'Belum ada tag aktif. Ketik nama tag lalu tekan Enter untuk membuat baru.'
                        : 'Semua tag aktif yang cocok sudah ditambahkan ke prompt ini.'}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Change Note if Editing */}
          {isEditing && (
            <div className="space-y-1.5 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl">
              <label className="text-xs font-bold text-amber-300">
                Catatan Revisi Versi (Riwayat)
              </label>
              <input
                type="text"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Contoh: Menambahkan modifier v6 dan optimasi pencahayaan..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2 outline-none"
              />
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              id="save-prompt-modal-btn"
            >
              {isEditing ? 'Simpan Perubahan' : 'Simpan Prompt Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
