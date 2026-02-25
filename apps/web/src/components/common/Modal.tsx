"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-900">{title}</div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-stone-500"
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="mt-3 text-sm text-stone-600">{children}</div>
    </div>
  );
}
