'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface LightDismissDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function LightDismissDialog({
  open,
  onClose,
  title,
  maxWidthClass = 'dialog-md',
  children,
}: LightDismissDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback para navegadores sem suporte nativo a <dialog closedby="any">
    let handleBackdropClick: ((event: MouseEvent) => void) | null = null;
    if (
      typeof HTMLDialogElement !== 'undefined' &&
      !('closedBy' in HTMLDialogElement.prototype)
    ) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`modal-dialog ${maxWidthClass}`}
      {...({ closedby: 'any' } as any)}
    >
      <div className="modal-header">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fechar janela"
        >
          <X size={18} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

