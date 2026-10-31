import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose }) {
  const closeRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...event.currentTarget.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      if (!focusable.length) return;
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
    const dialog = closeRef.current?.closest('[role="dialog"]');
    dialog?.addEventListener('keydown', onKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <motion.div className="modal-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl" initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id={titleId} className="font-semibold text-ink">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" aria-label={`Close ${title}`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

export function Field({ label, error, children, className = '', ...props }) {
  const uniqueId = useId();
  const fieldId = props.id || `field-${uniqueId}`;
  const labelId = `${fieldId}-label`;
  const control = isValidElement(children) ? cloneElement(children, { 'aria-labelledby': labelId, 'aria-invalid': Boolean(error) || children.props['aria-invalid'] }) : children;
  return (
    <label className={`grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 ${className}`}>
      <span id={labelId}>{label}</span>
      {control || <input id={fieldId} className="field" aria-labelledby={labelId} aria-invalid={Boolean(error)} {...props} />}
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

export function SelectField({ label, children, ...props }) {
  return <Field label={label}><select id={props.id || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="field" {...props}>{children}</select></Field>;
}

export function FormError({ message }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}
