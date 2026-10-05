import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import styles from './StackedBarChart.module.css';

interface ChartTooltipProps {
  label: string;
  x: number;
  y: number;
  viewport: HTMLDivElement | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  keyboardNavigation: RefObject<boolean>;
  children: ReactNode;
}

export function ChartTooltip({
  label,
  x,
  y,
  viewport,
  scrollRef,
  keyboardNavigation,
  children,
}: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    const scroller = scrollRef.current;
    if (!tooltip || !viewport || !scroller) return;

    function keepCategoryVisible() {
      if (!scroller || !keyboardNavigation.current) return;
      const edge = 48;
      if (x < scroller.scrollLeft + edge || x > scroller.scrollLeft + scroller.clientWidth - edge) {
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 2);
      }
    }

    function position() {
      if (!tooltip || !viewport || !scroller) return;
      const { width, height } = tooltip.getBoundingClientRect();
      const anchorX = x - scroller.scrollLeft;
      const offset = 12;
      const preferredX = anchorX + offset + width <= viewport.clientWidth
        ? anchorX + offset
        : anchorX - width - offset;
      const preferredY = y + offset + height <= viewport.clientHeight
        ? y + offset
        : y - height - offset;
      const left = Math.max(0, Math.min(preferredX, viewport.clientWidth - width));
      const top = Math.max(0, Math.min(preferredY, viewport.clientHeight - height));
      tooltip.style.transform = `translate(${left}px, ${top}px)`;
    }

    function resize() {
      keepCategoryVisible();
      position();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    observer.observe(tooltip);
    scroller.addEventListener('scroll', position, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', position);
    };
  }, [x, y, viewport, scrollRef, keyboardNavigation]);

  return (
    <div ref={tooltipRef} className={styles.tooltip} role="tooltip" aria-label={label}>
      {children}
    </div>
  );
}
