// EntityDialogs.js — modais Nexa para editar e apagar tabelas/colunas

import { h } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.js';
import { Button, Dialog } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.js';
import { COLUMN_TYPES } from '../../data.js';

export function EntityEditDialog({ draft, onChange, onCancel, onSubmit }) {
  const isColumn = draft?.kind === 'column';

  return h(Dialog, {
    open: Boolean(draft),
    onClose: onCancel,
    title: isColumn ? 'Editar coluna' : 'Editar tabela',
    draggable: true,
    className: 'mm-entity-dialog',
    actions: h('div', { className: 'mm-dialog-actions' },
      h(Button, { variant: 'tonal', onClick: onCancel }, 'Cancelar'),
      h(Button, { variant: 'contained', onClick: onSubmit }, 'Salvar'),
    ),
  },
    draft && h('div', { className: 'mm-dialog-form' },
      h('label', { className: 'mm-dialog-field' },
        h('span', { className: 'mm-dialog-label' }, isColumn ? 'Nome da coluna' : 'Nome da tabela'),
        h('input', {
          className: 'mm-dialog-input',
          value: draft.name,
          onInput: (e) => onChange({ name: e.target.value }),
          autoFocus: true,
        }),
      ),
      isColumn && h('label', { className: 'mm-dialog-field' },
        h('span', { className: 'mm-dialog-label' }, 'Tipo'),
        h('select', {
          className: 'mm-dialog-input',
          value: draft.type,
          onChange: (e) => onChange({ type: e.target.value }),
        },
          ...COLUMN_TYPES.map((type) => h('option', { key: type, value: type }, type)),
        ),
      ),
      draft.error && h('p', { className: 'mm-dialog-error' }, draft.error),
    ),
  );
}

export function EntityDeleteDialog({ target, onCancel, onConfirm }) {
  const isColumn = target?.kind === 'column';

  return h(Dialog, {
    open: Boolean(target),
    onClose: onCancel,
    title: isColumn ? 'Apagar coluna' : 'Apagar tabela',
    draggable: true,
    className: 'mm-entity-dialog',
    actions: h('div', { className: 'mm-dialog-actions' },
      h(Button, { variant: 'tonal', onClick: onCancel }, 'Cancelar'),
      h(Button, { variant: 'danger', onClick: onConfirm }, 'Apagar'),
    ),
  },
    target && h('div', { className: 'mm-dialog-confirm' },
      h('p', null, `Apagar ${isColumn ? 'a coluna' : 'a tabela'} "${target.name}"?`),
      h('p', { className: 'mm-dialog-muted' },
        isColumn
          ? 'Relações ligadas a esta coluna também serão removidas.'
          : 'Relações ligadas a esta tabela também serão removidas.'
      ),
    ),
  );
}
