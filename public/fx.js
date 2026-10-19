// Movimento do site. Cada animação responde a algo: o conteúdo chegou, a busca respondeu,
// a seção mudou. Nada se mexe sozinho depois disso. Sem JS ou com "reduzir movimento",
// a página aparece estática e completa.
import { animate } from './vendor/motion.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = [0.22, 1, 0.36, 1];
const $ = s => document.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const seen = new WeakSet();
const fresh = els => els.filter(el => !seen.has(el) && seen.add(el));

const reveal = (el, delay = 0) => animate(el,
  { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], transform: ['translateY(14px)', 'translateY(0px)'] },
  { duration: 0.7, delay, ease });
const settle = (els, base = 0, step = 0.05, dy = 8) => els.forEach((el, i) =>
  animate(el, { opacity: [0, 1], transform: [`translateY(${dy}px)`, 'translateY(0px)'] },
    { duration: 0.4, delay: base + Math.min(i, 10) * step, ease }));

/* Capa: a manchete principal sobe primeiro, o resto chega atrás dela. */
const front = $('#brasil');
if (front && !reduce) {
  new MutationObserver(() => {
    const [h] = fresh($$('.lead h2', front));
    if (h) {
      reveal(h);
      settle($$('.lead .meta', front), 0.1, 0, 0);
      settle($$('.sub', front), 0.3, 0.1);
      settle($$('.latest li', front), 0.4, 0.05, 6);
    }
  }).observe(front, { childList: true, subtree: true });
}

/* Busca: os resultados entram em fila curta quando a resposta chega. */
const results = $('#results-list');
if (results && !reduce) {
  new MutationObserver(() => settle(fresh($$('li:not(.empty)', results)), 0, 0.03))
    .observe(results, { childList: true });
}

/* Matéria: título sobe, a linha do veredito é desenhada, a imagem se revela ao carregar. */
const art = $('#art');
if (art && !reduce) {
  new MutationObserver(() => {
    const [piece] = fresh($$('.piece', art));
    if (!piece) return;
    reveal($('h1', piece));
    settle($$('.deck', piece), 0.15, 0, 6);
    $$('.rule', piece).forEach(r => animate(r, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 0.8, delay: 0.5, ease }));
    $$('.fig img', piece).forEach(img => {
      const go = () => animate(img, { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], transform: ['scale(1.04)', 'scale(1)'] }, { duration: 0.9, ease });
      img.complete && img.naturalWidth ? go() : img.addEventListener('load', go, { once: true });
    });
  }).observe(art, { childList: true });
}

/* Navegação: a barra preta acompanha a editoria que está na tela. Funciona também com movimento reduzido, só sem deslizar. */
const nav = $('#nav');
const ind = nav && $('.nav-ind', nav);
if (nav && ind) {
  const links = $$('a[href^="#"]', nav);
  const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  let current = -1, px = 0, pw = 1;

  const place = (i, instant) => {
    const a = links[i], cs = getComputedStyle(a);
    const x = a.offsetLeft, w = Math.max(1, a.offsetWidth - parseFloat(cs.paddingRight));
    if (instant || reduce || current < 0) ind.style.transform = `translateX(${x}px) scaleX(${w})`;
    else animate(ind, { transform: [`translateX(${px}px) scaleX(${pw})`, `translateX(${x}px) scaleX(${w})`] }, { duration: 0.35, ease });
    px = x; pw = w;
    if (x < nav.scrollLeft || x + w > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, x - 24), behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const update = () => {
    const mark = 72 + innerHeight * 0.25;
    let i = 0;
    targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top <= mark) i = k; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) i = links.length - 1;
    if (i === current) return;
    links.forEach((a, k) => k === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
    place(i);
    current = i;
  };

  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
  addEventListener('resize', () => { if (current >= 0) place(current, true); });
  document.fonts && document.fonts.ready.then(() => { if (current >= 0) place(current, true); });
  update();
}
