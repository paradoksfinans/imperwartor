/** Misst die Grösse eines Elements und hält sie aktuell. */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';

export function useElementSize<T extends Element>(): [MutableRefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        setSize({ width: box.width, height: box.height });
      }
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
