import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';

export default function DashModal({ open, onClose, icon: Icon, title, children }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="dm-backdrop" onClick={onClose}>
      <div className="dm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dm-header">
          {Icon && <Icon className="dm-header-icon" />}
          <span className="dm-header-title">{title}</span>
          <button className="dm-close" onClick={onClose} aria-label="Chiudi">
            <LuX />
          </button>
        </div>
        <div className="dm-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
