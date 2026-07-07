// useEntityDialogs.js — estado + renderização dos diálogos de editar/apagar
// tabelas e colunas, compartilhado entre Sidebar e DiagramCanvas

import { h, Fragment, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { EntityDeleteDialog, EntityEditDialog } from './EntityDialogs.js';

export function useEntityDialogs({ selectedTable, onSelectTable }) {
  const { updateTable, removeTable, updateColumn, removeColumn } = useModelCtx();
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
      error: '',
    });
  }

  function requestDeleteTable(table) {
    setDeleteTarget({ kind: 'table', tableId: table.id, name: table.name });
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

    if (editDraft.kind === 'table') {
      updateTable(editDraft.tableId, { name: cleanName });
    } else {
      updateColumn(editDraft.tableId, editDraft.columnId, {
        name: cleanName,
        type: editDraft.type,
      });
    }
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

  return { editTable, editColumn, requestDeleteTable, requestDeleteColumn, dialogs };
}
