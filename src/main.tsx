import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { FieldApp } from './field/FieldApp.tsx';
import './index.css';

// Одна сборка обслуживает два режима: штаб (демо на localStorage) и полевой
// режим, который ходит в API. Разделяет их хеш — так работает и на статике,
// и на своём сервере, без правил переписывания URL.
const FIELD_ROUTE = /^#\/(eq|kit|stock|queue|defects|field)(\/|$)/;

const isFieldMode = (): boolean => FIELD_ROUTE.test(window.location.hash);

const root = createRoot(document.getElementById('root')!);

const render = () => {
  root.render(<StrictMode>{isFieldMode() ? <FieldApp /> : <App />}</StrictMode>);
};

// Переход между режимами перерисовывает всё дерево: у них разное состояние
// и общего контекста нет.
let fieldMode = isFieldMode();
window.addEventListener('hashchange', () => {
  if (isFieldMode() !== fieldMode) {
    fieldMode = isFieldMode();
    render();
  }
});

render();

// Service worker нужен только собранному приложению: он и делает возможным
// открыть склад без сети. В разработке он мешал бы горячей перезагрузке.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Регистрация не удалась (например, http без TLS) — приложение
      // продолжает работать, просто без офлайн-загрузки.
    });
  });
}
