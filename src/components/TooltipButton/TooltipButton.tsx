import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import styles from './TooltipButton.module.css';

type TooltipButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  tooltip: string;
};

export function TooltipButton({
  tooltip, children, onPointerEnter, onPointerLeave, onFocus, onBlur, onClick, ...props
}: TooltipButtonProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function show() {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function dismiss() {
    clearTimeout(closeTimer.current);
    setOpen(false);
  }
  function leave() {
    clearTimeout(closeTimer.current);
    // Allow the pointer to cross the gap between the button and tooltip.
    closeTimer.current = setTimeout(() => {
      if (!buttonRef.current?.matches(':focus-visible')) setOpen(false);
    }, 150);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

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
      const above = anchor.top - box.height - 8;
      const top = above >= inset ? above : anchor.bottom + 8;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(inset, Math.min(top, window.innerHeight - box.height - inset))}px`;
    }
    function close() { setOpen(false); }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        {...props}
        ref={buttonRef}
        aria-label={props['aria-label'] ?? tooltip}
        aria-describedby={[props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') show();
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          leave();
          onPointerLeave?.(event);
        }}
        onFocus={(event) => { show(); onFocus?.(event); }}
        onBlur={(event) => { dismiss(); onBlur?.(event); }}
        onClick={(event) => { dismiss(); onClick?.(event); }}
      >
        {children}
      </button>
      {open ? createPortal(
        <div
          id={id}
          ref={panelRef}
          className={styles.tooltip}
          role="tooltip"
          onPointerEnter={show}
          onPointerLeave={leave}
          onClick={(event) => event.stopPropagation()}
        >
          {tooltip}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
