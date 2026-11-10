/**
 * Fensterrahmen für alle modalen Ansichten.
 * Schließt mit Escape und per Klick auf den Hintergrund, fängt den Fokus
 * und sperrt das Scrollen der Seite dahinter.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface WindowProps {
  title: string;
  icon?: IconName;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  /** Verhindert das Schließen, solange eine Entscheidung nötig ist. */
  blocking?: boolean;
}

export function Window({
  title,
  icon,
  children,
  footer,
  onClose,
  wide,
  blocking = false
}: WindowProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !blocking && onClose) {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [blocking, onClose]);

  return (
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !blocking && onClose) onClose();
      }}
    >
      <div
        className={`window${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="window-head">
          {icon ? <Icon name={icon} size={20} /> : null}
          <h3>{title}</h3>
          {!blocking && onClose ? (
            <button type="button" className="quiet small" onClick={onClose} aria-label="Schließen">
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </header>
        <div className="window-body scroll">{children}</div>
        {footer ? <footer className="window-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
