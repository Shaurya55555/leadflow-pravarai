"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Accessible name of the dialog. */
  label: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Controls rendered in the header, to the left of the close button. */
  actions?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Thin wrapper over the native <dialog>: focus trapping, Esc handling and a backdrop for free. */
export function Modal({ label, title, subtitle, actions, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={`m-auto max-h-[90vh] w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} overflow-hidden rounded-xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50`}
    >
      <div className="flex max-h-[90vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        </header>
        {children}
      </div>
    </dialog>
  );
}
