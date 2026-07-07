// app.js — ponto de entrada do Model Maker

import { h, render } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { ModelCtx, useModelState } from './components/model-context/ModelContext.js';
import Shell from './components/shell/Shell.js';

function App() {
  const model = useModelState();
  return ModelCtx.provide(model, () => h(Shell));
}

render(App, document.getElementById('app'));
