'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle, Trash2, Send, Clock, X, HelpCircle } from 'lucide-react';

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

  const confirm = (opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (loading) return;
    setIsOpen(false);
    setOptions(null);
  };

  const handleConfirm = async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      setIsOpen(false);
      setOptions(null);
    } catch (e) {
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
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
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight leading-snug">
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
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200 font-sans">
              {options.message}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
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
