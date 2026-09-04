'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Smile,
  Hash,
  AtSign,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

interface RichContentEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  label?: string;
  helperText?: string;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

const POPULAR_EMOJIS = [
  '🔥', '🚀', '💡', '✨', '📈', '🎯', '👇', '📌', '💬', '❤️',
  '👏', '🎉', '📢', '🌟', '⏱️', '🎬', '📸', '⚡', '🤩', '✅',
  '🙌', '💯', '🛒', '🎁', '📅', '🏆', '👀', '💼', '🤝', '☕',
];

// Mathematical bold / italic Unicode converter for social media captions (IG, TikTok, FB, etc.)
function toUnicodeBold(text: string): string {
  return text.split('').map((char) => {
    const code = char.charCodeAt(0);
    // Uppercase A-Z
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1d5d4 + (code - 65));
    }
    // Lowercase a-z
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1d5ee + (code - 97));
    }
    // Digits 0-9
    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(0x1d7ec + (code - 48));
    }
    return char;
  }).join('');
}

function toUnicodeItalic(text: string): string {
  return text.split('').map((char) => {
    const code = char.charCodeAt(0);
    // Uppercase A-Z
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1d608 + (code - 65));
    }
    // Lowercase a-z
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1d622 + (code - 97));
    }
    return char;
  }).join('');
}

export default function RichContentEditor({
  id,
  value,
  onChange,
  placeholder = 'Tulis konten, caption, atau naskah di sini...',
  minHeight = '180px',
  maxHeight = '420px',
  className = '',
  label,
  helperText,
  maxLength,
  disabled = false,
  required = false,
  autoFocus = false,
  onSubmit,
}: RichContentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSosmedModal, setShowSosmedModal] = useState(false);

  // Auto focus if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Insert or wrap text at current cursor / selection
  const wrapOrInsert = (prefix: string, suffix: string = prefix, defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let replacement = '';
    let newCursorPos = 0;

    if (selectedText.length > 0) {
      // If already wrapped, unwrap
      if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= prefix.length + suffix.length) {
        replacement = selectedText.slice(prefix.length, selectedText.length - suffix.length);
        newCursorPos = start + replacement.length;
      } else {
        replacement = `${prefix}${selectedText}${suffix}`;
        newCursorPos = start + replacement.length;
      }
    } else {
      // Empty selection, insert placeholder or just prefix+suffix
      const insertText = defaultPlaceholder || '';
      replacement = `${prefix}${insertText}${suffix}`;
      newCursorPos = start + prefix.length + insertText.length;
    }

    const nextValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(nextValue);

    // Reposition cursor
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  // Insert line prefix (for bullets, numbers, quotes)
  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Find the start of the current line
    const lastNewline = value.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const currentLine = value.substring(lineStart, end);
    let nextValue = '';

    if (currentLine.startsWith(prefix)) {
      // Toggle off prefix
      nextValue = value.substring(0, lineStart) + currentLine.slice(prefix.length) + value.substring(end);
    } else {
      nextValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
    }

    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + prefix.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // Insert raw string (e.g. emoji, hashtag, mention)
  const insertText = (str: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const nextValue = value.substring(0, start) + str + value.substring(end);
    onChange(nextValue);

    const nextPos = start + str.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPos, nextPos);
    });
  };

  // Convert selected text to Unicode Bold / Italic
  const convertSelectionToUnicode = (mode: 'bold' | 'italic') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    if (!selected) {
      // If nothing selected, insert example
      insertText(mode === 'bold' ? toUnicodeBold('teks tebal') : toUnicodeItalic('teks miring'));
      return;
    }

    const converted = mode === 'bold' ? toUnicodeBold(selected) : toUnicodeItalic(selected);
    const nextValue = value.substring(0, start) + converted + value.substring(end);
    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + converted.length, start + converted.length);
    });
  };

  // Handle Keyboard Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+B / Cmd+B -> Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapOrInsert('**', '**', 'teks tebal');
    }
    // Ctrl+I / Cmd+I -> Italic
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapOrInsert('*', '*', 'teks miring');
    }
    // Ctrl+Enter -> Submit (optional)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isNearMax = maxLength ? charCount >= maxLength * 0.9 : false;
  const isOverMax = maxLength ? charCount > maxLength : false;

  return (
    <div
      className={`space-y-1.5 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-4 sm:p-8 flex flex-col justify-center items-center'
          : ''
      } ${className}`}
    >
      {/* Label and Character / Word stats */}
      <div className="flex items-center justify-between gap-2">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium ml-auto">
          <span>{wordCount} Kata</span>
          <span>•</span>
          <span className={isOverMax ? 'text-rose-600 font-bold' : isNearMax ? 'text-amber-600 font-semibold' : ''}>
            {charCount} {maxLength ? `/ ${maxLength}` : 'Karakter'}
          </span>
        </div>
      </div>

      {/* Editor Box */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden flex flex-col bg-white shadow-2xs ${
          isFullscreen
            ? 'w-full max-w-4xl h-[85vh] shadow-2xl border-slate-300'
            : 'border-slate-200 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-400/10'
        } ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''}`}
      >
        {/* Sleek Action Toolbar */}
        <div className="px-2.5 py-1.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-1 select-none">
          {/* Left Toolbar: Text formatting buttons */}
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => wrapOrInsert('**', '**', 'teks tebal')}
              title="Tebal (Ctrl+B)"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition font-bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => wrapOrInsert('*', '*', 'teks miring')}
              title="Miring (Ctrl+I)"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => wrapOrInsert('~~', '~~', 'teks coret')}
              title="Coret Teks"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-slate-300 mx-1 self-center" />

            <button
              type="button"
              tabIndex={-1}
              onClick={() => insertLinePrefix('• ')}
              title="Daftar Poin (Bullet List)"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => insertLinePrefix('1. ')}
              title="Daftar Nomor"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => insertLinePrefix('> ')}
              title="Kutipan (Quote)"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200 transition"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-slate-300 mx-1 self-center" />

            <button
              type="button"
              tabIndex={-1}
              onClick={() => insertText('#')}
              title="Tambah Hashtag (#)"
              className="p-1.5 rounded text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition font-bold"
            >
              <Hash className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => insertText('@')}
              title="Tambah Mention (@)"
              className="p-1.5 rounded text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition"
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>

            {/* Emoji Popover Button */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Pilih Emoji"
                className={`p-1.5 rounded transition flex items-center gap-1 ${
                  showEmojiPicker
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
              </button>

              {/* Emoji Drawer Dropdown */}
              {showEmojiPicker && (
                <div className="absolute left-0 top-full mt-1.5 z-30 w-64 p-2 bg-white rounded-xl shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Emoji Populer Medsos
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs px-1"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto pr-0.5">
                    {POPULAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          insertText(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="p-1 rounded text-base hover:bg-slate-100 active:scale-110 transition flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Toolbar: Format Sosmed Tools & Fullscreen */}
          <div className="flex items-center gap-1">
            {/* Sosmed Formatting Utility Helper */}
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowSosmedModal(!showSosmedModal)}
                title="Format Font Khusus Medsos (IG/TikTok Bold & Italic)"
                className="px-2 py-1 rounded text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline">Format Sosmed</span>
              </button>

              {showSosmedModal && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-72 p-3 bg-white rounded-xl shadow-xl border border-slate-200 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Generator Font Asli Medsos</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSosmedModal(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed">
                    Ubah teks terpilih menjadi karakter Unicode asli yang tetap tebal/miring saat di-copy ke Instagram &amp; TikTok:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        convertSelectionToUnicode('bold');
                        setShowSosmedModal(false);
                      }}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-xs transition"
                    >
                      𝗕𝗼𝗹𝗱 𝗨𝗻𝗶𝗰𝗼𝗱𝗲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        convertSelectionToUnicode('italic');
                        setShowSosmedModal(false);
                      }}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 italic rounded text-xs transition"
                    >
                      𝘐𝘵𝘢𝘭𝘪𝘤 𝘜𝘯𝘪𝘤𝘰𝘥𝘦
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Buka Layar Penuh (Fokus Naskah)'}
              className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Textarea Area */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              minHeight: isFullscreen ? '100%' : minHeight,
              maxHeight: isFullscreen ? 'none' : maxHeight,
            }}
            className={`w-full p-3.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none resize-y leading-relaxed font-sans flex-1 selection:bg-blue-100 ${
              isFullscreen ? 'h-full resize-none p-6 text-sm leading-loose' : ''
            }`}
          />
        </div>
      </div>

      {/* Helper text if available */}
      {helperText && !isFullscreen && (
        <p className="text-[10.5px] text-slate-500 leading-relaxed">{helperText}</p>
      )}

      {/* Fullscreen backdrop exit button */}
      {isFullscreen && (
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="mt-3 text-xs text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium shadow-md transition flex items-center gap-1.5"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Selesai / Keluar Layar Penuh</span>
        </button>
      )}
    </div>
  );
}
