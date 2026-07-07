// Sidebar.js — painel lateral: Tabelas | Relações | Exportar

import { h, useRef, useState, useMemo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { COLUMN_TYPES, CARDINALITIES, BLANK_COLUMN } from '../../data.js';
import { inferModelFromJsonText } from '../importer/JsonImport.js';
import { EntityDeleteDialog, EntityEditDialog } from '../entity-dialogs/EntityDialogs.js';

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

// ─── Sub-componente: aba Exportar ─────────────────────────────────────────────

function ExportTab({ tables, relations, onOpenSchema }) {
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
    });
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
      h('button', { className: 'mm-copy-btn', type: 'button', onClick: copy },
        copied ? '✓ Copiado!' : '⎘ Copiar',
      ),
    ),
    error && h('p', { className: 'mm-json-error' }, error),
    summary && h('p', { className: 'mm-json-summary' }, summary),
    h('pre', { className: 'mm-code' }, code || '(sem tabelas)'),
  );
}



const JSON_HIGHLIGHT_RE = /("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:])/g;

function jsonTokenClass(token, rest) {
  if (token === '{' || token === '}' || token === '[' || token === ']') return 'mm-json-token-punct';
  if (token === ',' || token === ':') return 'mm-json-token-mark';
  if (token === 'true' || token === 'false') return 'mm-json-token-bool';
  if (token === 'null') return 'mm-json-token-null';
  if (/^-?\d/.test(token)) return 'mm-json-token-number';
  if (token.startsWith('"')) return /^\s*:/.test(rest) ? 'mm-json-token-key' : 'mm-json-token-string';
  return '';
}

function highlightJson(text) {
  if (!text) return '';

  const parts = [];
  let last = 0;
  let match;
  let key = 0;
  JSON_HIGHLIGHT_RE.lastIndex = 0;

  while ((match = JSON_HIGHLIGHT_RE.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    parts.push(h('span', {
      key: `tok-${key++}`,
      className: jsonTokenClass(token, text.slice(JSON_HIGHLIGHT_RE.lastIndex)),
    }, token));
    last = JSON_HIGHLIGHT_RE.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function JsonHighlightedEditor({ value, onInput }) {
  const highlightRef = useRef(null);

  function syncScroll(e) {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = e.target.scrollTop;
    highlightRef.current.scrollLeft = e.target.scrollLeft;
  }

  const highlighted = useMemo(() => value ? highlightJson(value) : '\n', [value]);

  return h('div', { className: 'mm-json-editor' },
    h('pre', { ref: highlightRef, className: 'mm-json-highlight', ariaHidden: 'true' },
      highlighted
    ),
    h('textarea', {
      className: 'mm-json-textarea',
      value,
      placeholder: 'Cole o JSON aqui...',
      spellCheck: false,
      onInput,
      onScroll: syncScroll,
    }),
  );
}

// ─── Sub-componente: aba JSON ─────────────────────────────────────────────────

function JsonImportTab({ onImport, onSelectTable }) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError]       = useState('');
  const [summary, setSummary]   = useState('');
  const jsonInputRef = useRef(null);

  async function openJsonFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');

    try {
      const text = await file.text();
      JSON.parse(text);
      setJsonText(text);
      setSummary(`Arquivo ${file.name} aberto.`);
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    } finally {
      e.target.value = '';
    }
  }

  function submitJson(e) {
    e.preventDefault();
    setError('');
    setSummary('');

    try {
      const model = inferModelFromJsonText(jsonText);
      onImport(model);
      if (model.tables[0]) onSelectTable(model.tables[0].id);
      setSummary(`${model.tables.length} tabela(s) e ${model.relations.length} relação(ões) importadas.`);
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    }
  }

  function formatJson() {
    setError('');
    setSummary('');
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    }
  }

  function clearJson() {
    setJsonText('');
    setError('');
    setSummary('');
  }

  return h('form', { className: 'mm-json-import', onSubmit: submitJson },
    h('input', {
      ref: jsonInputRef,
      className: 'mm-file-input',
      type: 'file',
      accept: '.json,application/json',
      onChange: openJsonFile,
    }),
    h(JsonHighlightedEditor, {
      value: jsonText,
      onInput: (e) => setJsonText(e.target.value),
    }),
    h('div', { className: 'mm-json-actions' },
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        onClick: () => jsonInputRef.current?.click(),
      }, 'Abrir JSON'),
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        disabled: !jsonText.trim(),
        onClick: formatJson,
      }, 'Formatar'),
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        disabled: !jsonText.trim(),
        onClick: clearJson,
      }, 'Limpar'),
      h('button', {
        className: 'mm-submit-btn',
        type: 'submit',
        disabled: !jsonText.trim(),
      }, 'Importar JSON'),
    ),
    error && h('p', { className: 'mm-json-error' }, error),
    summary && h('p', { className: 'mm-json-summary' }, summary),
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export default function Sidebar({ selectedTable, onSelectTable }) {
  const {
    tables, relations,
    addTable, updateTable, removeTable,
    addColumn, updateColumn, moveColumn, removeColumn,
    addRelation, removeRelation,
    importModel, replaceModel,
  } = useModelCtx();

  const [tab, setTab]               = useState('tables');
  const [sidebarWide, setSidebarWide] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [newTName, setNewTName]     = useState('');
  const [addColFor, setAddColFor]   = useState(null);
  const [newCol, setNewCol]         = useState({ ...BLANK_COLUMN });
  const [addingRel, setAddingRel]   = useState(false);
  const [newRel, setNewRel]         = useState({
    fromTable: '', fromColumn: '', toTable: '', toColumn: '', cardinality: '1:N',
  });
  const [editDraft, setEditDraft]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function submitTable(e) {
    e.preventDefault();
    if (!newTName.trim()) return;
    const id = addTable(newTName.trim());
    setNewTName('');
    setAddingTable(false);
    onSelectTable(id);
  }

  function submitColumn(e) {
    e.preventDefault();
    if (!newCol.name.trim() || !addColFor) return;
    addColumn(addColFor, { ...newCol, name: newCol.name.trim() });
    setNewCol({ ...BLANK_COLUMN });
    setAddColFor(null);
  }

  function submitRelation(e) {
    e.preventDefault();
    if (!newRel.fromTable || !newRel.toTable || newRel.fromTable === newRel.toTable) return;
    addRelation({ ...newRel });
    setNewRel({ fromTable: '', fromColumn: '', toTable: '', toColumn: '', cardinality: '1:N' });
    setAddingRel(false);
  }

  function toggleTable(id) {
    onSelectTable(id === selectedTable ? null : id);
  }

  function openSchema(model) {
    replaceModel(model);
    onSelectTable(model.tables[0]?.id || null);
  }

  function editTable(t) {
    setEditDraft({ kind: 'table', tableId: t.id, name: t.name, error: '' });
  }

  function editColumn(tableId, col) {
    setEditDraft({
      kind: 'column',
      tableId,
      columnId: col.id,
      name: col.name,
      type: col.type,
      error: '',
    });
  }

  function requestDeleteTable(t) {
    setDeleteTarget({ kind: 'table', tableId: t.id, name: t.name });
  }

  function requestDeleteColumn(tableId, col) {
    setDeleteTarget({ kind: 'column', tableId, columnId: col.id, name: col.name });
  }

  function updateEditDraft(patch) {
    setEditDraft((draft) => draft ? { ...draft, ...patch, error: '' } : draft);
  }

  function closeEditDialog() {
    setEditDraft(null);
  }

  function submitEditDialog() {
    if (!editDraft) return;
    const cleanName = editDraft.name.trim();
    if (!cleanName) {
      setEditDraft((draft) => ({ ...draft, error: 'Informe um nome.' }));
      return;
    }

    if (editDraft.kind === 'table') {
      updateTable(editDraft.tableId, { name: cleanName });
      closeEditDialog();
      return;
    }

    updateColumn(editDraft.tableId, editDraft.columnId, {
      name: cleanName,
      type: editDraft.type,
    });
    closeEditDialog();
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  function confirmDeleteDialog() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'table') {
      removeTable(deleteTarget.tableId);
      if (selectedTable === deleteTarget.tableId) onSelectTable(null);
    } else {
      removeColumn(deleteTarget.tableId, deleteTarget.columnId);
    }
    closeDeleteDialog();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return h('aside', { className: `mm-sidebar${sidebarWide ? ' mm-sidebar--wide' : ''}` },

    // ── Tabs ─────────────────────────────────────────────────────────────
    h('div', { className: 'mm-tabs' },
      ['tables', 'relations', 'json', 'export'].map((t) =>
        h('button', {
          key: t,
          className: `mm-tab${tab === t ? ' mm-tab--on' : ''}`,
          onClick: () => setTab(t),
        }, { tables: 'Tabelas', relations: 'Relações', json: 'JSON', export: 'Exportar' }[t])
      ),
      h('button', {
        className: `mm-sidebar-toggle${sidebarWide ? ' mm-sidebar-toggle--on' : ''}`,
        type: 'button',
        title: sidebarWide ? 'Recolher menu lateral' : 'Expandir menu lateral',
        onClick: () => setSidebarWide((value) => !value),
      }, sidebarWide ? '↤' : '↔'),
    ),

    // ════════════════════════════════════════════════════════════════════
    // ABA: Tabelas
    // ════════════════════════════════════════════════════════════════════
    tab === 'tables' && h('div', { className: 'mm-tab-body' },

      h('button', {
        className: 'mm-add-btn',
        onClick: () => { setAddingTable((v) => !v); setNewTName(''); },
      }, addingTable ? '✕ Cancelar' : '+ Nova Tabela'),

      // Form: nova tabela
      addingTable && h('form', { className: 'mm-form', onSubmit: submitTable },
        h('input', {
          className: 'mm-input',
          placeholder: 'nome_da_tabela...',
          value: newTName,
          onInput: (e) => setNewTName(e.target.value),
          autoFocus: true,
        }),
        h('button', { className: 'mm-submit-btn', type: 'submit' }, 'Criar'),
      ),

      // Lista de tabelas
      tables.length === 0
        ? h('p', { className: 'mm-empty' }, 'Nenhuma tabela.')
        : h('ul', { className: 'mm-table-list' },
          ...tables.map((tbl) => {
            const isOpen = selectedTable === tbl.id;
            return h('li', { key: tbl.id, className: `mm-tbl-item${isOpen ? ' mm-tbl-item--open' : ''}` },

              // Cabeçalho do item
              h('div', { className: 'mm-tbl-header' },
                h('button', { className: 'mm-tbl-name', onClick: () => toggleTable(tbl.id) },
                  h('span', { className: 'mm-tbl-chevron' }, isOpen ? '▾' : '▸'),
                  tbl.name,
                ),
                h('button', {
                  className: 'mm-icon-btn mm-edit-btn',
                  onClick: () => editTable(tbl),
                  title: 'Editar tabela',
                }, '✎'),
                h('button', {
                  className: 'mm-icon-btn mm-del-btn',
                  onClick: () => requestDeleteTable(tbl),
                  title: 'Remover',
                }, '✕'),
              ),

              // Colunas (aberto)
              isOpen && h('div', { className: 'mm-col-panel' },

                tbl.columns.length === 0
                  ? h('p', { className: 'mm-empty-sm' }, 'Sem colunas.')
                  : h('ul', { className: 'mm-col-list' },
                    ...tbl.columns.map((col, index) =>
                      h('li', { key: col.id, className: 'mm-col-item' },
                        h('div', { className: 'mm-col-badges' },
                          col.pk && h('span', { className: 'mm-badge-pk' }, 'PK'),
                          col.fk && h('span', { className: 'mm-badge-fk' }, 'FK'),
                          !col.nullable && !col.pk && h('span', { className: 'mm-badge-nn' }, 'NN'),
                        ),
                        h('span', { className: 'mm-col-n' }, col.name),
                        h('span', { className: 'mm-col-t' }, col.type),
                        h('div', { className: 'mm-col-order' },
                          h('button', {
                            className: 'mm-icon-btn mm-order-btn',
                            disabled: index === 0,
                            onClick: () => moveColumn(tbl.id, col.id, 'up'),
                            title: 'Mover coluna para cima',
                          }, '↑'),
                          h('button', {
                            className: 'mm-icon-btn mm-order-btn',
                            disabled: index === tbl.columns.length - 1,
                            onClick: () => moveColumn(tbl.id, col.id, 'down'),
                            title: 'Mover coluna para baixo',
                          }, '↓'),
                        ),
                        h('button', {
                          className: 'mm-icon-btn mm-edit-btn',
                          onClick: () => editColumn(tbl.id, col),
                          title: 'Editar coluna',
                        }, '✎'),
                        h('button', {
                          className: 'mm-icon-btn mm-del-btn',
                          onClick: () => requestDeleteColumn(tbl.id, col),
                          title: 'Remover coluna',
                        }, '✕'),
                      )
                    ),
                  ),

                // Form: nova coluna
                addColFor === tbl.id
                  ? h('form', { className: 'mm-col-form', onSubmit: submitColumn },
                    h('input', {
                      className: 'mm-input mm-input--sm',
                      placeholder: 'nome_coluna...',
                      value: newCol.name,
                      onInput: (e) => setNewCol((c) => ({ ...c, name: e.target.value })),
                      autoFocus: true,
                    }),
                    h('select', {
                      className: 'mm-select',
                      value: newCol.type,
                      onChange: (e) => setNewCol((c) => ({ ...c, type: e.target.value })),
                    },
                      ...COLUMN_TYPES.map((t) => h('option', { key: t, value: t }, t))
                    ),
                    h('div', { className: 'mm-checks' },
                      h('label', null,
                        h('input', {
                          type: 'checkbox', checked: newCol.pk,
                          onChange: (e) => setNewCol((c) => ({ ...c, pk: e.target.checked })),
                        }), ' PK',
                      ),
                      h('label', null,
                        h('input', {
                          type: 'checkbox', checked: newCol.fk,
                          onChange: (e) => setNewCol((c) => ({ ...c, fk: e.target.checked })),
                        }), ' FK',
                      ),
                      h('label', null,
                        h('input', {
                          type: 'checkbox', checked: newCol.nullable,
                          onChange: (e) => setNewCol((c) => ({ ...c, nullable: e.target.checked })),
                        }), ' NULL',
                      ),
                    ),
                    h('div', { className: 'mm-form-row' },
                      h('button', { className: 'mm-submit-btn', type: 'submit' }, 'Adicionar'),
                      h('button', {
                        className: 'mm-cancel-btn', type: 'button',
                        onClick: () => { setAddColFor(null); setNewCol({ ...BLANK_COLUMN }); },
                      }, 'Cancelar'),
                    ),
                  )
                  : h('button', {
                    className: 'mm-add-col-btn',
                    onClick: () => { setAddColFor(tbl.id); setNewCol({ ...BLANK_COLUMN }); },
                  }, '+ Coluna'),
              ),
            );
          }),
        ),
    ),

    // ════════════════════════════════════════════════════════════════════
    // ABA: Relações
    // ════════════════════════════════════════════════════════════════════
    tab === 'relations' && h('div', { className: 'mm-tab-body' },

      tables.length < 2
        ? h('p', { className: 'mm-empty' }, 'Crie pelo menos 2 tabelas para adicionar relações.')
        : h('button', {
          className: 'mm-add-btn',
          onClick: () => setAddingRel((v) => !v),
        }, addingRel ? '✕ Cancelar' : '+ Nova Relação'),

      // Form: nova relação
      addingRel && tables.length >= 2 && h('form', {
        className: 'mm-form mm-rel-form',
        onSubmit: submitRelation,
      },
        h('label', { className: 'mm-label' }, 'De'),
        h('select', {
          className: 'mm-select',
          value: newRel.fromTable,
          onChange: (e) => setNewRel((r) => ({
            ...r,
            fromTable: e.target.value,
            fromColumn: '',
            toTable: r.toTable === e.target.value ? '' : r.toTable,
            toColumn: r.toTable === e.target.value ? '' : r.toColumn,
          })),
        },
          h('option', { value: '' }, '— tabela —'),
          ...tables.map((t) => h('option', { key: t.id, value: t.id }, t.name)),
        ),
        newRel.fromTable && h('select', {
          className: 'mm-select',
          value: newRel.fromColumn,
          onChange: (e) => setNewRel((r) => ({ ...r, fromColumn: e.target.value })),
        },
          h('option', { value: '' }, '— coluna (opcional) —'),
          ...(tables.find((t) => t.id === newRel.fromTable)?.columns || [])
            .map((c) => h('option', { key: c.id, value: c.id }, c.name)),
        ),

        h('label', { className: 'mm-label' }, 'Para'),
        h('select', {
          className: 'mm-select',
          value: newRel.toTable,
          onChange: (e) => setNewRel((r) => ({ ...r, toTable: e.target.value, toColumn: '' })),
        },
          h('option', { value: '' }, '— tabela —'),
          ...tables
            .filter((t) => t.id !== newRel.fromTable)
            .map((t) => h('option', { key: t.id, value: t.id }, t.name)),
        ),
        newRel.toTable && h('select', {
          className: 'mm-select',
          value: newRel.toColumn,
          onChange: (e) => setNewRel((r) => ({ ...r, toColumn: e.target.value })),
        },
          h('option', { value: '' }, '— coluna (opcional) —'),
          ...(tables.find((t) => t.id === newRel.toTable)?.columns || [])
            .map((c) => h('option', { key: c.id, value: c.id }, c.name)),
        ),

        h('label', { className: 'mm-label' }, 'Cardinalidade'),
        h('select', {
          className: 'mm-select',
          value: newRel.cardinality,
          onChange: (e) => setNewRel((r) => ({ ...r, cardinality: e.target.value })),
        },
          ...CARDINALITIES.map((c) => h('option', { key: c.value, value: c.value }, c.label)),
        ),

        h('button', { className: 'mm-submit-btn', type: 'submit' }, 'Criar Relação'),
      ),

      // Lista de relações
      relations.length === 0
        ? h('p', { className: 'mm-empty' }, 'Nenhuma relação.')
        : h('ul', { className: 'mm-rel-list' },
          ...relations.map((rel) => {
            const ft = tables.find((t) => t.id === rel.fromTable);
            const tt = tables.find((t) => t.id === rel.toTable);
            const fc = ft?.columns.find((c) => c.id === rel.fromColumn);
            const tc = tt?.columns.find((c) => c.id === rel.toColumn);
            return h('li', { key: rel.id, className: 'mm-rel-item' },
              h('div', { className: 'mm-rel-info' },
                h('span', { className: 'mm-rel-card' }, rel.cardinality),
                h('span', { className: 'mm-rel-tables' },
                  (ft?.name || '?') + (fc ? `.${fc.name}` : ''),
                  ' → ',
                  (tt?.name || '?') + (tc ? `.${tc.name}` : ''),
                ),
              ),
              h('button', {
                className: 'mm-icon-btn mm-del-btn',
                onClick: () => removeRelation(rel.id),
                title: 'Remover',
              }, '✕'),
            );
          }),
        ),
    ),

    // ════════════════════════════════════════════════════════════════════
    // ABA: JSON
    // ════════════════════════════════════════════════════════════════════
    tab === 'json' && h(JsonImportTab, { onImport: importModel, onSelectTable }),

    // ════════════════════════════════════════════════════════════════════
    // ABA: Exportar
    // ════════════════════════════════════════════════════════════════════
    tab === 'export' && h(ExportTab, { tables, relations, onOpenSchema: openSchema }),
    h(EntityEditDialog, {
      draft: editDraft,
      onChange: updateEditDraft,
      onCancel: closeEditDialog,
      onSubmit: submitEditDialog,
    }),
    h(EntityDeleteDialog, {
      target: deleteTarget,
      onCancel: closeDeleteDialog,
      onConfirm: confirmDeleteDialog,
    }),
  );
}
