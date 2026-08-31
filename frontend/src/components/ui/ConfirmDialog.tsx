'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, Trash2, Send, X, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'publish';
  onConfirm: () => void | Promise<void>;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const confirm = (opts: ConfirmOptions) => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    setOptions(opts);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
    setOptions(null);
  };

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingRef.current) {
        setIsOpen(false);
        setOptions(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      setIsOpen(false);
      setOptions(null);
    } catch {
      // Handled in caller
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (options?.type) {
      case 'danger':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'publish':
        return <Send className="w-5 h-5 text-slate-900" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      default:
        return <HelpCircle className="w-5 h-5 text-slate-700" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (options?.type) {
      case 'danger':
        return 'ui-btn bg-rose-600 hover:bg-rose-700 text-white border-rose-600';
      case 'publish':
        return 'ui-btn ui-btn-primary';
      case 'warning':
        return 'ui-btn bg-amber-600 hover:bg-amber-700 text-white border-amber-600';
      default:
        return 'ui-btn ui-btn-primary';
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && options && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            ref={dialogRef}
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                    options.type === 'danger'
                      ? 'bg-rose-50 border-rose-200'
                      : options.type === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {getIcon()}
                </div>
                <div>
                  <h3 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900 tracking-tight leading-snug">
                    {options.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono uppercase">
                    Konfirmasi Tindakan
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="text-slate-400 hover:text-slate-600 p-1 transition"
                aria-label="Tutup dialog konfirmasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div id="confirm-dialog-message" className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 font-sans">
              {options.message}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                ref={cancelButtonRef}
                onClick={handleClose}
                disabled={loading}
                className="ui-btn ui-btn-secondary text-xs"
              >
                {options.cancelText || 'Batal'}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`${getConfirmButtonClass()} text-xs`}
              >
                {loading ? 'Memproses...' : options.confirmText || 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
