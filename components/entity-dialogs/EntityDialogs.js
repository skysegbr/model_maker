// EntityDialogs.js — modais Nexa para editar e apagar tabelas/colunas

import { h } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { Button, Dialog } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
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
      isColumn && h('div', { className: 'mm-dialog-row' },
        h('label', { className: 'mm-dialog-field mm-dialog-field--grow' },
          h('span', { className: 'mm-dialog-label' }, 'Tipo'),
          h('select', {
            className: 'mm-dialog-input',
            value: draft.type,
            onChange: (e) => onChange({ type: e.target.value }),
          },
            ...COLUMN_TYPES.map((type) => h('option', { key: type, value: type }, type)),
          ),
        ),
        h('label', { className: 'mm-dialog-field mm-dialog-field--size' },
          h('span', { className: 'mm-dialog-label' }, 'Tamanho'),
          h('input', {
            className: 'mm-dialog-input',
            value: draft.size,
            placeholder: '255 ou 10,2',
            onInput: (e) => onChange({ size: e.target.value }),
          }),
        ),
      ),
      isColumn && h('label', { className: 'mm-dialog-field' },
        h('span', { className: 'mm-dialog-label' }, 'Valor padrão (DEFAULT)'),
        h('input', {
          className: 'mm-dialog-input',
          value: draft.default,
          placeholder: 'ex.: 0, CURRENT_TIMESTAMP, texto...',
          onInput: (e) => onChange({ default: e.target.value }),
        }),
      ),
      isColumn && h('div', { className: 'mm-dialog-checks' },
        DialogCheck({ draft, onChange, label: 'PK', prop: 'pk' }),
        DialogCheck({ draft, onChange, label: 'FK', prop: 'fk' }),
        DialogCheck({ draft, onChange, label: 'NULL', prop: 'nullable' }),
        DialogCheck({ draft, onChange, label: 'UNIQUE', prop: 'unique' }),
        DialogCheck({ draft, onChange, label: 'AUTO INC', prop: 'autoInc' }),
      ),
      draft.error && h('p', { className: 'mm-dialog-error' }, draft.error),
    ),
  );
}

function DialogCheck({ draft, onChange, label, prop }) {
  return h('label', { key: prop, className: 'mm-dialog-check' },
    h('input', {
      type: 'checkbox',
      checked: Boolean(draft[prop]),
      onChange: (e) => onChange({ [prop]: e.target.checked }),
    }),
    ` ${label}`,
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
