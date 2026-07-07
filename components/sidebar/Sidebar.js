// Sidebar.js — painel lateral: Tabelas | Relações | JSON | Exportar

import { h, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { useModelCtx, validateTableName, validateColumnName } from '../model-context/ModelContext.js';
import { COLUMN_TYPES, CARDINALITIES, BLANK_COLUMN } from '../../data.js';
import { ExportTab } from './ExportTab.js';
import { JsonImportTab } from './JsonImportTab.js';
import { SqlImportTab } from './SqlImportTab.js';
import { useEntityDialogs } from '../entity-dialogs/useEntityDialogs.js';

export default function Sidebar({ selectedTable, onSelectTable, onFocusTable }) {
  const {
    tables, relations,
    addTable, addColumn, moveColumn,
    addRelation, updateRelation, removeRelation,
    importModel, replaceModel,
  } = useModelCtx();

  const [tab, setTab]               = useState('tables');
  const [sidebarWide, setSidebarWide] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [newTName, setNewTName]     = useState('');
  const [newTError, setNewTError]   = useState('');
  const [addColFor, setAddColFor]   = useState(null);
  const [newCol, setNewCol]         = useState({ ...BLANK_COLUMN });
  const [newColError, setNewColError] = useState('');
  const [addingRel, setAddingRel]   = useState(false);
  const [newRel, setNewRel]         = useState({
    fromTable: '', fromColumn: '', toTable: '', toColumn: '', cardinality: '1:N',
  });
  const [editRelId, setEditRelId]    = useState(null);
  const [editRelCard, setEditRelCard] = useState('');
  const { editTable, editColumn, requestDeleteTable, requestDeleteColumn, dialogs } =
    useEntityDialogs({ selectedTable, onSelectTable });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function submitTable(e) {
    e.preventDefault();
    const name = newTName.trim();
    if (!name) return;
    const error = validateTableName(tables, name);
    if (error) { setNewTError(error); return; }
    const id = addTable(name);
    setNewTName('');
    setNewTError('');
    setAddingTable(false);
    onSelectTable(id);
    onFocusTable?.(id);
  }

  function submitColumn(e) {
    e.preventDefault();
    const name = newCol.name.trim();
    const size = newCol.size.trim();
    if (!name || !addColFor) return;
    const table = tables.find((t) => t.id === addColFor);
    let error = table ? validateColumnName(table, name) : '';
    if (!error && size && !/^\d+(\s*,\s*\d+)?$/.test(size)) {
      error = 'Tamanho inválido: use "255" ou "10,2".';
    }
    if (error) { setNewColError(error); return; }
    addColumn(addColFor, { ...newCol, name, size });
    setNewCol({ ...BLANK_COLUMN });
    setNewColError('');
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
    const next = id === selectedTable ? null : id;
    onSelectTable(next);
    if (next) onFocusTable?.(next); // centraliza a tabela no canvas
  }

  function openSchema(model) {
    replaceModel(model);
    const first = model.tables[0]?.id || null;
    onSelectTable(first);
    if (first) onFocusTable?.(first);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return h('aside', { className: `mm-sidebar${sidebarWide ? ' mm-sidebar--wide' : ''}` },

    // ── Tabs ─────────────────────────────────────────────────────────────
    h('div', { className: 'mm-tabs' },
      ['tables', 'relations', 'json', 'sql', 'export'].map((t) =>
        h('button', {
          key: t,
          className: `mm-tab${tab === t ? ' mm-tab--on' : ''}`,
          onClick: () => setTab(t),
        }, { tables: 'Tabelas', relations: 'Relações', json: 'JSON', sql: 'SQL', export: 'Exportar' }[t])
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
        onClick: () => { setAddingTable((v) => !v); setNewTName(''); setNewTError(''); },
      }, addingTable ? '✕ Cancelar' : '+ Nova Tabela'),

      // Form: nova tabela
      addingTable && h('form', { className: 'mm-form', onSubmit: submitTable },
        h('input', {
          className: 'mm-input',
          placeholder: 'nome_da_tabela...',
          value: newTName,
          onInput: (e) => { setNewTName(e.target.value); setNewTError(''); },
          autoFocus: true,
        }),
        newTError && h('p', { className: 'mm-msg-error' }, newTError),
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
                        h('span', { className: 'mm-col-t' }, col.type + (col.size ? `(${col.size})` : '')),
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
                      onInput: (e) => { setNewCol((c) => ({ ...c, name: e.target.value })); setNewColError(''); },
                      autoFocus: true,
                    }),
                    newColError && h('p', { className: 'mm-msg-error' }, newColError),
                    h('div', { className: 'mm-form-row' },
                      h('select', {
                        className: 'mm-select',
                        value: newCol.type,
                        onChange: (e) => setNewCol((c) => ({ ...c, type: e.target.value })),
                      },
                        ...COLUMN_TYPES.map((t) => h('option', { key: t, value: t }, t))
                      ),
                      h('input', {
                        className: 'mm-input mm-input--sm mm-input--size',
                        placeholder: 'tam.',
                        title: 'Tamanho/precisão: 255 ou 10,2',
                        value: newCol.size,
                        onInput: (e) => { setNewCol((c) => ({ ...c, size: e.target.value })); setNewColError(''); },
                      }),
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
                        onClick: () => { setAddColFor(null); setNewCol({ ...BLANK_COLUMN }); setNewColError(''); },
                      }, 'Cancelar'),
                    ),
                  )
                  : h('button', {
                    className: 'mm-add-col-btn',
                    onClick: () => { setAddColFor(tbl.id); setNewCol({ ...BLANK_COLUMN }); setNewColError(''); },
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
              editRelId === rel.id
                ? h('div', { className: 'mm-rel-edit' },
                    h('select', {
                      className: 'mm-input mm-rel-card-sel',
                      value: editRelCard,
                      onChange: (e) => setEditRelCard(e.target.value),
                    }, ...CARDINALITIES.map((c) => h('option', { key: c.value, value: c.value }, c.value))),
                    h('button', {
                      className: 'mm-icon-btn',
                      onClick: () => { updateRelation(rel.id, { cardinality: editRelCard }); setEditRelId(null); },
                      title: 'Salvar',
                    }, '✓'),
                    h('button', { className: 'mm-icon-btn', onClick: () => setEditRelId(null), title: 'Cancelar' }, '✕'),
                  )
                : h('div', { className: 'mm-rel-info' },
                    h('span', { className: 'mm-rel-card' }, rel.cardinality),
                    h('span', { className: 'mm-rel-tables' },
                      (ft?.name || '?') + (fc ? `.${fc.name}` : ''),
                      ' → ',
                      (tt?.name || '?') + (tc ? `.${tc.name}` : ''),
                    ),
                  ),
              h('div', { className: 'mm-rel-actions' },
                editRelId !== rel.id && h('button', {
                  className: 'mm-icon-btn',
                  onClick: () => { setEditRelId(rel.id); setEditRelCard(rel.cardinality); },
                  title: 'Editar cardinalidade',
                }, '✎'),
                h('button', {
                  className: 'mm-icon-btn mm-del-btn',
                  onClick: () => removeRelation(rel.id),
                  title: 'Remover',
                }, '✕'),
              ),
            );
          }),
        ),
    ),

    // ════════════════════════════════════════════════════════════════════
    // ABA: JSON
    // ════════════════════════════════════════════════════════════════════
    tab === 'json' && h(JsonImportTab, {
      onImport: importModel,
      onSelectTable: (id) => { onSelectTable(id); if (id) onFocusTable?.(id); },
    }),

    // ════════════════════════════════════════════════════════════════════
    // ABA: SQL
    // ════════════════════════════════════════════════════════════════════
    tab === 'sql' && h(SqlImportTab, {
      onImport: importModel,
      onSelectTable: (id) => { onSelectTable(id); if (id) onFocusTable?.(id); },
    }),

    // ════════════════════════════════════════════════════════════════════
    // ABA: Exportar
    // ════════════════════════════════════════════════════════════════════
    tab === 'export' && h(ExportTab, { tables, relations, onOpenSchema: openSchema }),

    dialogs,
  );
}
