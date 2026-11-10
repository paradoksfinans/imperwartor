/**
 * Kamera der Karte.
 *
 * Statt die Kartengruppe zu verschieben, wird die viewBox des SVG bewegt.
 * Dadurch sind Bildschirm- und Kartenkoordinaten exakt umrechenbar - das
 * ist die Grundlage für Minikarte, Zeigerhinweise und Zielpfeile.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from 'react';
import { clamp } from '../utils/helpers';

export interface WorldBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  cx: number;
  cy: number;
  scale: number;
}

const MIN_SCALE = 0.85;
const MAX_SCALE = 7;

/** Liest die viewBox-Angabe einer Karte. */
export function parseViewBox(viewBox: string): WorldBox {
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return { x: 0, y: 0, width: 1000, height: 700 };
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

export function useMapCamera(world: WorldBox, viewport: { width: number; height: number }) {
  const [camera, setCamera] = useState<Camera>({
    cx: world.x + world.width / 2,
    cy: world.y + world.height / 2,
    scale: 1
  });
  const [dragging, setDragging] = useState(false);

  const drag = useRef<{ active: boolean; id: number; x: number; y: number; cx: number; cy: number; moved: boolean }>({
    active: false,
    id: -1,
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    moved: false
  });
  const pinch = useRef<{ active: boolean; distance: number; scale: number }>({
    active: false,
    distance: 0,
    scale: 1
  });

  const aspect = viewport.height > 0 ? viewport.width / viewport.height : 1.5;

  /** Sichtbarer Kartenausschnitt bei Zoomstufe 1: die ganze Karte. */
  const baseWidth = useMemo(
    () => Math.max(world.width, world.height * aspect),
    [world.width, world.height, aspect]
  );

  const visible = useMemo(() => {
    const width = baseWidth / camera.scale;
    const height = width / (aspect || 1.5);
    return { width, height };
  }, [baseWidth, camera.scale, aspect]);

  /** Hält den Ausschnitt in der Nähe der Karte. */
  const clampCamera = useCallback(
    (next: Camera): Camera => {
      const width = baseWidth / next.scale;
      const height = width / (aspect || 1.5);
      const marginX = Math.min(world.width * 0.35, width * 0.45);
      const marginY = Math.min(world.height * 0.35, height * 0.45);
      return {
        scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
        cx: clamp(next.cx, world.x - marginX, world.x + world.width + marginX),
        cy: clamp(next.cy, world.y - marginY, world.y + world.height + marginY)
      };
    },
    [baseWidth, aspect, world]
  );

  const viewBox = useMemo(() => {
    const x = camera.cx - visible.width / 2;
    const y = camera.cy - visible.height / 2;
    return `${x.toFixed(2)} ${y.toFixed(2)} ${visible.width.toFixed(2)} ${visible.height.toFixed(2)}`;
  }, [camera.cx, camera.cy, visible]);

  const box: WorldBox = useMemo(
    () => ({
      x: camera.cx - visible.width / 2,
      y: camera.cy - visible.height / 2,
      width: visible.width,
      height: visible.height
    }),
    [camera.cx, camera.cy, visible]
  );

  /** Rechnet Bildschirmkoordinaten in Kartenkoordinaten um. */
  const screenToWorld = useCallback(
    (clientX: number, clientY: number, element: SVGSVGElement | null) => {
      if (!element) return { x: camera.cx, y: camera.cy };
      const rect = element.getBoundingClientRect();
      const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
      const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
      return {
        x: box.x + rx * box.width,
        y: box.y + ry * box.height
      };
    },
    [box, camera.cx, camera.cy]
  );

  /** Zoomt und hält dabei den Punkt unter dem Zeiger fest. */
  const zoomAt = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setCamera((current) => {
        const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
        if (!anchor) return clampCamera({ ...current, scale });
        const ratio = current.scale / scale;
        return clampCamera({
          scale,
          cx: anchor.x + (current.cx - anchor.x) * ratio,
          cy: anchor.y + (current.cy - anchor.y) * ratio
        });
      });
    },
    [clampCamera]
  );

  const reset = useCallback(() => {
    setCamera({
      cx: world.x + world.width / 2,
      cy: world.y + world.height / 2,
      scale: 1
    });
  }, [world]);

  /** Setzt den Mittelpunkt, etwa beim Klick in die Minikarte. */
  const centerOn = useCallback(
    (x: number, y: number, scale?: number) => {
      setCamera((current) => clampCamera({ cx: x, cy: y, scale: scale ?? Math.max(current.scale, 1.8) }));
    },
    [clampCamera]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      drag.current = {
        active: true,
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cx: camera.cx,
        cy: camera.cy,
        moved: false
      };
      setDragging(true);
    },
    [camera.cx, camera.cy]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!drag.current.active || drag.current.id !== event.pointerId) return;
      if (pinch.current.active) return;
      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const perPixelX = rect.width > 0 ? box.width / rect.width : 1;
      const perPixelY = rect.height > 0 ? box.height / rect.height : 1;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
      setCamera((current) =>
        clampCamera({
          ...current,
          cx: drag.current.cx - dx * perPixelX,
          cy: drag.current.cy - dy * perPixelY
        })
      );
    },
    [box.width, box.height, clampCamera]
  );

  const endDrag = useCallback(() => {
    drag.current.active = false;
    setDragging(false);
  }, []);

  const onWheel = useCallback(
    (event: ReactWheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const anchor = screenToWorld(event.clientX, event.clientY, event.currentTarget);
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, anchor);
    },
    [screenToWorld, zoomAt]
  );

  const onTouchStart = useCallback(
    (event: ReactTouchEvent<SVGSVGElement>) => {
      if (event.touches.length === 2) {
        const [a, b] = [event.touches[0], event.touches[1]];
        pinch.current = {
          active: true,
          distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          scale: camera.scale
        };
      }
    },
    [camera.scale]
  );

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<SVGSVGElement>) => {
      if (!pinch.current.active || event.touches.length !== 2) return;
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.current.distance <= 0) return;
      const target = clamp(
        pinch.current.scale * (distance / pinch.current.distance),
        MIN_SCALE,
        MAX_SCALE
      );
      const anchor = screenToWorld(
        (a.clientX + b.clientX) / 2,
        (a.clientY + b.clientY) / 2,
        event.currentTarget
      );
      setCamera((current) => {
        const ratio = current.scale / target;
        return clampCamera({
          scale: target,
          cx: anchor.x + (current.cx - anchor.x) * ratio,
          cy: anchor.y + (current.cy - anchor.y) * ratio
        });
      });
    },
    [clampCamera, screenToWorld]
  );

  const onTouchEnd = useCallback(() => {
    pinch.current.active = false;
  }, []);

  /** True, wenn die letzte Zeigerbewegung ein Ziehen war. */
  const wasDragged = useCallback(() => drag.current.moved, []);

  return {
    camera,
    viewBox,
    box,
    dragging,
    zoomAt,
    reset,
    centerOn,
    screenToWorld,
    wasDragged,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: endDrag,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd
    }
  };
}
