// Minimap.js — miniatura do canvas com a vista atual; clique/arraste navega

import { h, useRef, useEffect, useCallback } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { CANVAS_SIZE } from '../../data.js';
import { TABLE_W, tableNodeHeight } from './TableNode.js';

export function Minimap({ tables, viewBox, onNavigate }) {
  const svgRef = useRef(null);

  // viewBox é propriedade DOM read-only — precisa de setAttribute
  useEffect(() => {
    svgRef.current?.setAttribute('viewBox', `0 0 ${CANVAS_SIZE.w} ${CANVAS_SIZE.h}`);
  }, []);

  const navigate = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    onNavigate(
      (clientX - rect.left) / rect.width  * CANVAS_SIZE.w,
      (clientY - rect.top)  / rect.height * CANVAS_SIZE.h,
    );
  }, [onNavigate]);

  function onPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(e.clientX, e.clientY);

    function onMove(mv) { navigate(mv.clientX, mv.clientY); }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return h('svg', {
    ref: svgRef,
    className: 'mm-minimap',
    onPointerDown,
  },
    ...tables.map((t) =>
      h('rect', {
        key: t.id,
        className: 'mm-minimap-table',
        x: t.x, y: t.y,
        width: TABLE_W,
        height: tableNodeHeight(t.columns),
        rx: 24,
      })
    ),
    h('rect', {
      className: 'mm-minimap-view',
      x: viewBox.x, y: viewBox.y,
      width: viewBox.w, height: viewBox.h,
      rx: 16,
    }),
  );
}
