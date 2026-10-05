import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './InfoPopover.module.css';

interface InfoPopoverProps {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}

export function InfoPopover({ label, trigger, children }: InfoPopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;

    function position() {
      if (!button || !panel) return;
      const anchor = button.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const inset = 12;
      const left = Math.max(inset, Math.min(
        anchor.left + anchor.width / 2 - box.width / 2,
        window.innerWidth - box.width - inset,
      ));
      const below = anchor.bottom + 8;
      const top = below + box.height <= window.innerHeight - inset
        ? below
        : anchor.top - box.height - 8;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(inset, Math.min(top, window.innerHeight - box.height - inset))}px`;
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node
        && !buttonRef.current?.contains(event.target)
        && !panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (event.relatedTarget !== null) setOpen(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <svg className={styles.indicator} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="5" stroke="currentColor" />
          <path d="M6 5.5v3M6 3.5v.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {trigger}
      </button>
      {open ? createPortal(
        <div
          id={id}
          ref={panelRef}
          className={styles.panel}
          role="tooltip"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
