// ExportTab.js — aba Exportar: gera Mermaid / SQL DDL / esquema JSON

import { h, useRef, useState, useMemo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';

// ─── Geração de código ────────────────────────────────────────────────────────

function generateMermaid(tables, relations) {
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));

  const blocks = tables.map((t) => {
    const cols = t.columns
      .map((c) => {
        const type = c.type.toLowerCase();
        const mod  = c.pk ? ' PK' : c.fk ? ' FK' : '';
        return `        ${type} ${c.name}${mod}`;
      })
      .join('\n');
    return `    ${t.name} {\n${cols || '        int id'}\n    }`;
  });

  const ARROW = { '1:1': '||--||', '1:N': '||--o{', 'N:M': '}o--o{' };
  const rels = relations
    .map((r) => {
      const ft = tableMap[r.fromTable];
      const tt = tableMap[r.toTable];
      if (!ft || !tt) return null;
      return `    ${ft.name} ${ARROW[r.cardinality] || '||--o{'} ${tt.name} : ""`;
    })
    .filter(Boolean);

  return `erDiagram\n${blocks.join('\n')}${rels.length ? '\n' + rels.join('\n') : ''}`;
}

function generateSQL(tables, relations) {
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));
  const colMap   = {};
  tables.forEach((t) => t.columns.forEach((c) => { colMap[c.id] = c; }));

  const ddls = tables.map((t) => {
    const lines = t.columns.length
      ? t.columns.map((c) => `    ${c.name} ${c.type}${!c.nullable || c.pk ? ' NOT NULL' : ''}`)
      : ['    id INT NOT NULL'];
    const pks = t.columns.filter((c) => c.pk).map((c) => c.name);
    lines.push(`    PRIMARY KEY (${pks.length ? pks.join(', ') : 'id'})`);
    return `CREATE TABLE ${t.name} (\n${lines.join(',\n')}\n);`;
  });

  const fks = relations
    .filter((r) => r.fromColumn && r.toColumn)
    .map((r) => {
      const ft = tableMap[r.fromTable];
      const tt = tableMap[r.toTable];
      const fc = colMap[r.fromColumn];
      const tc = colMap[r.toColumn];
      if (!ft || !tt || !fc || !tc) return null;
      return `ALTER TABLE ${ft.name}\n    ADD CONSTRAINT fk_${ft.name}_${fc.name}\n    FOREIGN KEY (${fc.name}) REFERENCES ${tt.name}(${tc.name});`;
    })
    .filter(Boolean);

  return [...ddls, ...fks].join('\n\n');
}

function generateSchema(tables, relations) {
  return JSON.stringify({
    version: 1,
    tables,
    relations,
  }, null, 2);
}

function normalizeSchema(input) {
  if (!input || !Array.isArray(input.tables) || !Array.isArray(input.relations)) {
    throw new Error('O esquema precisa ter tables e relations.');
  }

  const tables = input.tables.map((table) => {
    if (!table?.id || !table?.name) throw new Error('Cada tabela do esquema precisa ter id e name.');
    return {
      ...table,
      columns: Array.isArray(table.columns) ? table.columns : [],
      x: Number.isFinite(table.x) ? table.x : 80,
      y: Number.isFinite(table.y) ? table.y : 70,
    };
  });

  const tableIds = new Set(tables.map((table) => table.id));
  const relations = input.relations.filter((rel) =>
    rel?.id && tableIds.has(rel.fromTable) && tableIds.has(rel.toTable)
  );

  return { tables, relations };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ExportTab({ tables, relations, onOpenSchema }) {
  const [fmt, setFmt]       = useState('mermaid');
  const [copied, setCopied] = useState(false);
  const [error, setError]   = useState('');
  const [summary, setSummary] = useState('');
  const schemaInputRef = useRef(null);

  const code = useMemo(() =>
    fmt === 'mermaid'
      ? generateMermaid(tables, relations)
      : fmt === 'sql'
        ? generateSQL(tables, relations)
        : generateSchema(tables, relations),
  [fmt, tables, relations]);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setError('Não foi possível copiar. Use o botão Baixar.'));
  }

  function download() {
    const ext  = fmt === 'sql' ? 'sql' : fmt === 'mermaid' ? 'mmd' : 'json';
    const mime = fmt === 'schema' ? 'application/json' : 'text/plain';
    const blob = new Blob([code], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `model.${ext}` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadSVG() {
    const svgEl = document.querySelector('.mm-canvas-svg');
    if (!svgEl) return;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const blob   = new Blob([svgStr], { type: 'image/svg+xml' });
    const url    = URL.createObjectURL(blob);
    const a      = Object.assign(document.createElement('a'), { href: url, download: 'diagram.svg' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openSchemaFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');

    try {
      const model = normalizeSchema(JSON.parse(await file.text()));
      onOpenSchema(model);
      setFmt('schema');
      setSummary(`${model.tables.length} tabela(s) e ${model.relations.length} relação(ões) abertas.`);
    } catch (err) {
      setError(err?.message || 'Esquema inválido.');
    } finally {
      e.target.value = '';
    }
  }

  return h('div', { className: 'mm-export' },
    h('input', {
      ref: schemaInputRef,
      className: 'mm-file-input',
      type: 'file',
      accept: '.json,application/json',
      onChange: openSchemaFile,
    }),
    h('div', { className: 'mm-export-fmt' },
      h('button', { className: `mm-fmt-btn${fmt === 'mermaid' ? ' active' : ''}`, onClick: () => setFmt('mermaid') }, 'Mermaid'),
      h('button', { className: `mm-fmt-btn${fmt === 'sql' ? ' active' : ''}`, onClick: () => setFmt('sql') }, 'SQL DDL'),
      h('button', { className: `mm-fmt-btn${fmt === 'schema' ? ' active' : ''}`, onClick: () => setFmt('schema') }, 'Esquema'),
    ),
    h('div', { className: 'mm-export-actions' },
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        onClick: () => schemaInputRef.current?.click(),
      }, 'Abrir esquema'),
      h('button', { className: 'mm-cancel-btn', type: 'button', onClick: downloadSVG }, '⬇ SVG'),
      h('button', { className: 'mm-cancel-btn', type: 'button', onClick: download }, '⬇ Baixar'),
      h('button', { className: 'mm-copy-btn', type: 'button', onClick: copy },
        copied ? '✓ Copiado!' : '⎘ Copiar',
      ),
    ),
    error && h('p', { className: 'mm-msg-error' }, error),
    summary && h('p', { className: 'mm-msg-ok' }, summary),
    h('pre', { className: 'mm-code' }, code || '(sem tabelas)'),
  );
}
