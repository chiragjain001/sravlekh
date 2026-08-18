'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AdminOverlapModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  badgeText?: string;
  badgeColor?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  width?: string;
  height?: string;
}

export function AdminOverlapModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  badgeText,
  badgeColor = 'bg-blue-50 text-blue-600 border-blue-100',
  children,
  footerActions,
  width = 'w-[75vw] max-w-5xl',
  height = 'h-[75vh] max-h-[85vh]',
}: AdminOverlapModalProps) {
  const isClosingFromPopstate = useRef(false);

  // Push history state when modal opens, close modal on browser back
  useEffect(() => {
    if (!isOpen) return;

    // Push a modal entry into window history
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, aiosModal: title },
        '',
        window.location.href
      );
    }

    const handlePopState = () => {
      isClosingFromPopstate.current = true;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up history state if closed via button instead of popstate
      if (typeof window !== 'undefined' && !isClosingFromPopstate.current && window.history.state?.aiosModal) {
        window.history.back();
      }
      isClosingFromPopstate.current = false;
    };
  }, [isOpen, onClose, title]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadein"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.5)' }}
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl ${width} ${height} flex flex-col overflow-hidden border border-slate-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 leading-tight">{title}</h3>
                {badgeText && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${badgeColor}`}>
                    {badgeText}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            aria-label="Close modal (Escape or Back)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">
            AIOS Super Admin Overview Modal
          </p>
          <div className="flex items-center gap-2">
            {footerActions}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
