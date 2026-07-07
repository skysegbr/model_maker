// RelationLines.js — linhas SVG de relacionamento entre tabelas

import { h } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.js';
import { TABLE_W, tableAnchors } from './TableNode.js';

/** Retorna o path de uma curva bezier cúbica entre dois pontos */
function bezierPath(from, to) {
  const dx = Math.abs(to.x - from.x);
  const cp = Math.max(dx * 0.55, 60);
  return `M ${from.x},${from.y} C ${from.x + cp * Math.sign(to.x - from.x)},${from.y} ${to.x - cp * Math.sign(to.x - from.x)},${to.y} ${to.x},${to.y}`;
}

/** Escolhe os pontos de ancoragem entre dois tabelas */
function pickAnchors(fromTable, toTable) {
  const fa = tableAnchors(fromTable);
  const ta = tableAnchors(toTable);
  const fromCenter = fromTable.x + TABLE_W / 2;
  const toCenter   = toTable.x  + TABLE_W / 2;
  return toCenter >= fromCenter
    ? { from: fa.right, to: ta.left }
    : { from: fa.left,  to: ta.right };
}

/** Marcadores de cardinalidade: retorna elementos SVG no ponto */
function CardMark({ pt, side, card }) {
  // side: 'from' | 'to'
  // side=from → marcador do lado "1"; side=to → marcador do lado "N"
  const dir = side === 'from' ? 1 : -1; // aponta para dentro da linha
  const x = pt.x;
  const y = pt.y;

  if (card === '1:1') {
    // Dois traços perpendiculares em ambos os lados
    return h('g', { className: 'mm-card-mark-group' },
      h('line', { className: 'mm-card-mark', x1: x + dir * 6, y1: y - 6, x2: x + dir * 6, y2: y + 6 }),
      h('line', { className: 'mm-card-mark', x1: x + dir * 11, y1: y - 6, x2: x + dir * 11, y2: y + 6 }),
    );
  }

  if (side === 'from') {
    // Lado "1": traço perpendicular simples
    return h('line', { className: 'mm-card-mark', x1: x + dir * 8, y1: y - 7, x2: x + dir * 8, y2: y + 7 });
  }

  // Lado "N" (crow's foot)
  return h('g', { className: 'mm-card-mark-group' },
    h('line', { className: 'mm-card-mark', x1: x,           y1: y,     x2: x + dir * 12, y2: y - 7 }),
    h('line', { className: 'mm-card-mark', x1: x,           y1: y,     x2: x + dir * 12, y2: y }),
    h('line', { className: 'mm-card-mark', x1: x,           y1: y,     x2: x + dir * 12, y2: y + 7 }),
    h('line', { className: 'mm-card-mark', x1: x + dir * 12, y1: y - 7, x2: x + dir * 12, y2: y + 7 }),
  );
}

export function RelationLines({ tables, relations, onRemove }) {
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));

  return h('g', { className: 'mm-relations' },
    ...relations.map((rel) => {
      const fromT = tableMap[rel.fromTable];
      const toT   = tableMap[rel.toTable];
      if (!fromT || !toT) return null;

      const { from, to } = pickAnchors(fromT, toT);
      const path = bezierPath(from, to);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - 10;

      const fromSide = from.x === fromT.x ? 'to' : 'from'; // right anchor = 'from' side
      const toSide   = to.x   === toT.x   ? 'from' : 'to';

      return h('g', { key: rel.id, className: 'mm-rel' },
        // Linha de relação
        h('path', { className: 'mm-rel-path', d: path }),

        // Marcadores de cardinalidade
        h(CardMark, { pt: from, side: fromSide, card: rel.cardinality }),
        h(CardMark, { pt: to,   side: toSide,   card: rel.cardinality }),

        // Label da cardinalidade
        h('rect', { className: 'mm-rel-label-bg', x: midX - 16, y: midY - 10, width: 32, height: 16, rx: 4 }),
        h('text', {
          className: 'mm-rel-label',
          x: midX, y: midY + 2,
          'text-anchor': 'middle',
          style: { userSelect: 'none', pointerEvents: 'none' },
        }, rel.cardinality),

        // Área clicável invisível para remover
        h('rect', {
          className: 'mm-rel-remove-area',
          x: midX - 16, y: midY - 10,
          width: 32, height: 16,
          onClick: () => onRemove(rel.id),
          title: 'Clique para remover',
        }),
      );
    }),
  );
}
