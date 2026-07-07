// RelationLines.js — linhas SVG de relacionamento entre tabelas

import { h, useMemo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
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

/** Marcador de cardinalidade em uma ponta da linha.
 *  pt: ponto de ancoragem (na borda da tabela)
 *  dir: +1 se a linha sai para a direita da tabela, -1 se sai para a esquerda
 *  kind: 'one' (traço perpendicular) | 'many' (pé-de-galinha) */
function CardMark({ pt, dir, kind }) {
  const x = pt.x;
  const y = pt.y;

  if (kind === 'one') {
    return h('line', { className: 'mm-card-mark', x1: x + dir * 8, y1: y - 7, x2: x + dir * 8, y2: y + 7 });
  }

  // 'many' — pé-de-galinha: converge na linha e abre em direção à tabela
  return h('g', { className: 'mm-card-mark-group' },
    h('line', { className: 'mm-card-mark', x1: x + dir * 12, y1: y, x2: x, y2: y - 7 }),
    h('line', { className: 'mm-card-mark', x1: x + dir * 12, y1: y, x2: x, y2: y }),
    h('line', { className: 'mm-card-mark', x1: x + dir * 12, y1: y, x2: x, y2: y + 7 }),
  );
}

export function RelationLines({ tables, relations, onRemove }) {
  const tableMap = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t])), [tables]);

  return h('g', { className: 'mm-relations' },
    ...relations.map((rel) => {
      const fromT = tableMap[rel.fromTable];
      const toT   = tableMap[rel.toTable];
      if (!fromT || !toT) return null;

      const { from, to } = pickAnchors(fromT, toT);
      const path = bezierPath(from, to);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - 10;

      // Direção geométrica: âncora esquerda → linha sai para a esquerda (-1)
      const fromDir = from.x === fromT.x ? -1 : 1;
      const toDir   = to.x   === toT.x   ? -1 : 1;

      // Forma semântica por ponta: origem = lado "1", destino = lado "N"
      const [fromKind, toKind] =
        rel.cardinality === '1:1' ? ['one', 'one']
        : rel.cardinality === 'N:M' ? ['many', 'many']
        : ['one', 'many'];

      return h('g', { key: rel.id, className: 'mm-rel' },
        // Linha de relação
        h('path', { className: 'mm-rel-path', d: path }),

        // Marcadores de cardinalidade
        h(CardMark, { pt: from, dir: fromDir, kind: fromKind }),
        h(CardMark, { pt: to,   dir: toDir,   kind: toKind }),

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
        },
          h('title', null, 'Clique para remover a relação'),
        ),
      );
    }),
  );
}
