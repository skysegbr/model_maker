// useEntityDialogs.js — estado + renderização dos diálogos de editar/apagar
// tabelas e colunas, compartilhado entre Sidebar e DiagramCanvas

import { h, Fragment, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { useModelCtx, validateTableName, validateColumnName } from '../model-context/ModelContext.js';
import { EntityDeleteDialog, EntityEditDialog } from './EntityDialogs.js';

export function useEntityDialogs({ selectedTable, onSelectTable }) {
  const { tables, updateTable, removeTable, updateColumn, removeColumn } = useModelCtx();
  const [editDraft, setEditDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function editTable(table) {
    setEditDraft({ kind: 'table', tableId: table.id, name: table.name, error: '' });
  }

  function editColumn(tableId, column) {
    setEditDraft({
      kind: 'column',
      tableId,
      columnId: column.id,
      name: column.name,
      type: column.type,
      size: column.size || '',
      nullable: column.nullable !== false,
      pk: Boolean(column.pk),
      fk: Boolean(column.fk),
      unique: Boolean(column.unique),
      autoInc: Boolean(column.autoInc),
      default: column.default || '',
      error: '',
    });
  }

  function requestDeleteTable(table) {
    setDeleteTarget({ kind: 'table', tableId: table.id, name: table.name });
  }

  function requestDeleteTables(tableList) {
    if (!tableList.length) return;
    if (tableList.length === 1) { requestDeleteTable(tableList[0]); return; }
    setDeleteTarget({
      kind: 'tables',
      ids: tableList.map((t) => t.id),
      name: `${tableList.length} tabelas`,
    });
  }

  function requestDeleteColumn(tableId, column) {
    setDeleteTarget({ kind: 'column', tableId, columnId: column.id, name: column.name });
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

    const table = tables.find((t) => t.id === editDraft.tableId);
    let error = editDraft.kind === 'table'
      ? validateTableName(tables, cleanName, editDraft.tableId)
      : table ? validateColumnName(table, cleanName, editDraft.columnId) : '';
    const cleanSize = (editDraft.size || '').trim();
    if (!error && editDraft.kind === 'column' && cleanSize && !/^\d+(\s*,\s*\d+)?$/.test(cleanSize)) {
      error = 'Tamanho inválido: use "255" ou "10,2".';
    }
    if (error) {
      setEditDraft((draft) => ({ ...draft, error }));
      return;
    }

    if (editDraft.kind === 'table') {
      updateTable(editDraft.tableId, { name: cleanName });
    } else {
      updateColumn(editDraft.tableId, editDraft.columnId, {
        name: cleanName,
        type: editDraft.type,
        size: cleanSize,
        nullable: editDraft.nullable,
        pk: editDraft.pk,
        fk: editDraft.fk,
        unique: editDraft.unique,
        autoInc: editDraft.autoInc,
        default: (editDraft.default || '').trim(),
      });
    }
    closeEditDialog();
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  function confirmDeleteDialog() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'tables') {
      deleteTarget.ids.forEach(removeTable);
      onSelectTable(null);
    } else if (deleteTarget.kind === 'table') {
      removeTable(deleteTarget.tableId);
      if (selectedTable === deleteTarget.tableId) onSelectTable(null);
    } else {
      removeColumn(deleteTarget.tableId, deleteTarget.columnId);
    }
    closeDeleteDialog();
  }

  const dialogs = h(Fragment, null,
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

  return { editTable, editColumn, requestDeleteTable, requestDeleteTables, requestDeleteColumn, dialogs };
}
