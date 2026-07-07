// SqlImportTab.js — aba SQL: cola CREATE TABLEs e gera o diagrama

import { h, useRef, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { parseSqlDDL } from './SqlImport.js';

export function SqlImportTab({ onImport, onSelectTable }) {
  const [sqlText, setSqlText] = useState('');
  const [error, setError]     = useState('');
  const [summary, setSummary] = useState('');
  const fileRef = useRef(null);

  async function openFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');
    try {
      setSqlText(await file.text());
      setSummary(`Arquivo ${file.name} aberto.`);
    } catch (err) {
      setError(err?.message || 'Não foi possível ler o arquivo.');
    } finally {
      e.target.value = '';
    }
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    setSummary('');
    try {
      const model = parseSqlDDL(sqlText);
      onImport(model);
      if (model.tables[0]) onSelectTable(model.tables[0].id);
      setSummary(`${model.tables.length} tabela(s) e ${model.relations.length} relação(ões) importadas. Use "Organizar" para o layout automático.`);
    } catch (err) {
      setError(err?.message || 'SQL inválido.');
    }
  }

  function clear() {
    setSqlText('');
    setError('');
    setSummary('');
  }

  return h('form', { className: 'mm-sql-import', onSubmit: submit },
    h('input', {
      ref: fileRef,
      className: 'mm-file-input',
      type: 'file',
      accept: '.sql,text/plain',
      onChange: openFile,
    }),
    h('textarea', {
      className: 'mm-sql-textarea',
      value: sqlText,
      placeholder: 'Cole aqui os CREATE TABLE... (MySQL ou PostgreSQL)',
      spellCheck: false,
      onInput: (e) => setSqlText(e.target.value),
    }),
    h('div', { className: 'mm-sql-actions' },
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        onClick: () => fileRef.current?.click(),
      }, 'Abrir SQL'),
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        disabled: !sqlText.trim(),
        onClick: clear,
      }, 'Limpar'),
      h('button', {
        className: 'mm-submit-btn',
        type: 'submit',
        disabled: !sqlText.trim(),
      }, 'Importar SQL'),
    ),
    error && h('p', { className: 'mm-msg-error' }, error),
    summary && h('p', { className: 'mm-msg-ok' }, summary),
  );
}
