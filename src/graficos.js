// Componentes visuais sem dependências: barras em HTML (responsivas) e SVG
// desenhado na largura real do contêiner (redesenhado ao redimensionar).

import { esc, int, pct, pctA, dec } from './util.js';

export function legenda(series) {
  return `<ul class="legenda">${series
    .map((s) => `<li><span class="sw" style="background:${s.cor}"></span>${esc(s.nome)}</li>`)
    .join('')}</ul>`;
}

export function tile(rotulo, valor, sub = '', destaque = false) {
  return `<div class="tile${destaque ? ' tile-destaque' : ''}">
    <div class="tile-rot">${esc(rotulo)}</div>
    <div class="tile-val">${valor}</div>
    ${sub ? `<div class="tile-sub">${sub}</div>` : ''}
  </div>`;
}

/**
 * Tabela simples. Células são HTML já escapado pelo chamador.
 * `num` = índices das colunas numéricas (alinhadas à direita).
 */
export function tabela({ cab, corpo, num = [], rodape = null, legenda: leg = '', classe = '' }) {
  const n = new Set(num);
  const td = (tag, cel, j) => `<${tag}${n.has(j) ? ' class="num"' : ''}>${cel}</${tag}>`;
  return `<div class="tabela-wrap"><table class="${classe}">
    <thead><tr>${cab.map((c, j) => td('th', c, j)).join('')}</tr></thead>
    <tbody>${corpo.map((l) => `<tr${l.classe ? ` class="${l.classe}"` : ''}>${(l.celulas || l).map((c, j) => td('td', c, j)).join('')}</tr>`).join('')}</tbody>
    ${rodape ? `<tfoot><tr>${rodape.map((c, j) => td('td', c, j)).join('')}</tr></tfoot>` : ''}
  </table></div>${leg ? `<p class="nota-tabela">${leg}</p>` : ''}`;
}

/** Célula de percentual com o volume absoluto embaixo. */
export function celPct(p, n, pequeno = false) {
  return `<span class="cel-pct${pequeno ? ' pequeno' : ''}">${pctA(p)}${pequeno ? '<sup>†</sup>' : ''}<small>${int(n)}</small></span>`;
}

/**
 * Barras horizontais 100% empilhadas.
 * linhas: [{ rotulo, sub?, valores: { chave: volume } }]
 * series: [{ chave, nome, cor, tinta }]
 */
export function barras100({ linhas, series, titulo = '' }) {
  const html = linhas
    .map((l) => {
      const total = series.reduce((s, se) => s + (l.valores[se.chave] || 0), 0);
      const resumo = [];
      const segs = series
        .map((se) => {
          const v = l.valores[se.chave] || 0;
          const p = total ? v / total : 0;
          resumo.push(`${se.nome} ${pctA(p)}`);
          if (p < 0.002) return '';
          const tip = `<b>${esc(l.rotulo)}</b><br><span class="sw" style="background:${se.cor}"></span>${esc(se.nome)}: <b>${pctA(p)}</b><br>${int(v)} de ${int(total)} veículos`;
          const rot = p >= 0.12 ? `<em style="color:${se.tinta}">${pct(p, 0)}</em>` : '';
          return `<span class="seg" style="flex-grow:${p};background:${se.cor}" data-tip="${esc(tip)}">${rot}</span>`;
        })
        .join('');
      return `<div class="b100-linha">
        <div class="b100-rot">${esc(l.rotulo)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</div>
        <div class="b100-barra" role="img" aria-label="${esc(`${l.rotulo}: ${resumo.join(', ')}`)}">${segs || '<span class="vazio">sem registros</span>'}</div>
      </div>`;
    })
    .join('');
  return `<figure class="grafico">${titulo ? `<figcaption>${titulo}</figcaption>` : ''}${legenda(series)}<div class="b100">${html}</div></figure>`;
}

/**
 * Barras horizontais simples (magnitude).
 * linhas: [{ rotulo, valor, texto, cor?, tip?, destaque? }]
 */
export function barrasH({ linhas, titulo = '', max = null }) {
  const m = max ?? Math.max(...linhas.map((l) => l.valor), 0);
  const html = linhas
    .map((l) => {
      const w = m > 0 ? (l.valor / m) * 100 : 0;
      const tip = l.tip ?? `<b>${esc(l.rotulo)}</b><br>${l.texto}`;
      return `<div class="bh-linha${l.destaque ? ' destaque' : ''}" data-tip="${esc(tip)}">
        <span class="bh-rot">${esc(l.rotulo)}</span>
        <span class="bh-trilho"><span class="bh-barra${l.valor > 0 ? ' positiva' : ''}" style="width:${w}%;${l.cor ? `background:${l.cor}` : ''}"></span></span>
        <span class="bh-val">${l.texto}</span>
      </div>`;
    })
    .join('');
  return `<figure class="grafico">${titulo ? `<figcaption>${titulo}</figcaption>` : ''}<div class="bh">${html}</div></figure>`;
}

// ---------- SVG responsivo ----------

const specs = new Map();
let seq = 0;

function placeholder(tipo, spec, extra = '') {
  const id = `g${++seq}`;
  specs.set(id, { tipo, spec });
  return `${extra}<div class="graf-svg" data-g="${id}" style="min-height:${spec.altura || 280}px"></div>`;
}

/**
 * Gráfico de linhas com eixo x categórico.
 * spec: { x: [rótulos], series: [{ nome, cor, valores }], fmt, fmtEixo?, ref?, zero?, altura?, titulo }
 */
export function grafLinhas(spec) {
  return `<figure class="grafico">${spec.titulo ? `<figcaption>${spec.titulo}</figcaption>` : ''}${placeholder('linhas', spec, spec.series.length > 1 ? legenda(spec.series) : '')}</figure>`;
}

/** Diagrama linear dos equipamentos ao longo da rodovia (posição por km). */
export function grafKm(spec) {
  return `<figure class="grafico">${spec.titulo ? `<figcaption>${spec.titulo}</figcaption>` : ''}${placeholder('km', { altura: 170, ...spec })}</figure>`;
}

export function ativarGraficos(raiz) {
  raiz.querySelectorAll('[data-g]').forEach((el) => {
    const s = specs.get(el.dataset.g);
    if (!s || el._ativo) return;
    el._ativo = true;
    const desenhar = () => {
      const w = Math.floor(el.clientWidth);
      if (!w || w === el._w) return;
      el._w = w;
      el.innerHTML = s.tipo === 'linhas' ? svgLinhas(s.spec, w) : svgKm(s.spec, w);
    };
    desenhar();
    if ('ResizeObserver' in window) new ResizeObserver(desenhar).observe(el);
  });
}

function marcas(min, max, n = 5) {
  const span = max - min || Math.abs(max) || 1;
  const bruto = span / n;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const r = bruto / mag;
  const passo = (r >= 7.5 ? 10 : r >= 3.5 ? 5 : r >= 1.5 ? 2 : 1) * mag;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const out = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) out.push(Number(v.toFixed(10)));
  return out;
}

function svgLinhas(s, W) {
  const H = s.altura || 280;
  const fmt = s.fmt || ((v) => dec(v, 1));
  const fmtEixo = s.fmtEixo || fmt;
  const rotulosDiretos = s.series.length > 1 && s.series.length <= 4 && W >= 560;
  const m = { t: 14, r: rotulosDiretos ? 128 : 16, b: 30, l: 58 };
  const iw = Math.max(10, W - m.l - m.r);
  const ih = H - m.t - m.b;
  const vals = s.series.flatMap((x) => x.valores).filter(Number.isFinite);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (s.ref != null) {
    lo = Math.min(lo, s.ref);
    hi = Math.max(hi, s.ref);
  }
  if (s.zero) lo = Math.min(0, lo);
  const tk = marcas(lo, hi, 5);
  lo = tk[0];
  hi = tk[tk.length - 1];
  const n = s.x.length;
  const banda = iw / n;
  const xs = (i) => m.l + banda * (i + 0.5);
  const ys = (v) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  let g = '';
  for (const t of tk) {
    g += `<line class="grade" x1="${m.l}" x2="${m.l + iw}" y1="${ys(t)}" y2="${ys(t)}"/>`;
    g += `<text class="eixo" x="${m.l - 8}" y="${ys(t)}" text-anchor="end" dominant-baseline="middle">${esc(fmtEixo(t))}</text>`;
  }
  if (s.ref != null) g += `<line class="ref" x1="${m.l}" x2="${m.l + iw}" y1="${ys(s.ref)}" y2="${ys(s.ref)}"/>`;
  const passoX = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / (s.larguraRotulo || 44)))));
  s.x.forEach((x, i) => {
    if (i % passoX === 0) g += `<text class="eixo" x="${xs(i)}" y="${H - 8}" text-anchor="middle">${esc(x)}</text>`;
  });

  for (const se of s.series) {
    const pts = se.valores.map((v, i) => (Number.isFinite(v) ? [xs(i), ys(v)] : null));
    let d = '';
    let novo = true;
    for (const p of pts) {
      if (!p) {
        novo = true;
        continue;
      }
      d += `${novo ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
      novo = false;
    }
    g += `<path class="linha" d="${d}" stroke="${se.cor}"/>`;
    if (n <= 40) for (const p of pts) if (p) g += `<circle class="ponto" cx="${p[0]}" cy="${p[1]}" r="4" fill="${se.cor}"/>`;
  }

  if (rotulosDiretos) {
    const fim = s.series
      .map((se) => ({ se, y: ys(se.valores[n - 1]) }))
      .filter((r) => Number.isFinite(r.y))
      .sort((a, b) => a.y - b.y);
    const cabem = fim.every((r, i) => i === 0 || r.y - fim[i - 1].y >= 14);
    if (cabem) {
      for (const r of fim) {
        g += `<text class="rot-direto" x="${xs(n - 1) + 10}" y="${r.y}" dominant-baseline="middle">${esc(r.se.nome)}</text>`;
      }
    }
  }

  s.x.forEach((x, i) => {
    const linhasTip = s.series
      .map((se) => `<span class="sw" style="background:${se.cor}"></span>${esc(se.nome)}: <b>${esc(fmt(se.valores[i]))}</b>`)
      .join('<br>');
    const tip = `<b>${esc(s.rotuloTip ? s.rotuloTip(i) : x)}</b><br>${linhasTip}`;
    g += `<g class="banda" data-tip="${esc(tip)}"><rect x="${m.l + banda * i}" y="${m.t}" width="${banda}" height="${ih}"/><line class="guia" x1="${xs(i)}" x2="${xs(i)}" y1="${m.t}" y2="${m.t + ih}"/></g>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.titulo || 'Gráfico de linhas')}">${g}</svg>`;
}

function svgKm(s, W) {
  const H = s.altura;
  const kms = s.pontos.map((p) => p.km);
  const kmin = Math.min(...kms);
  const kmax = Math.max(...kms);
  const folga = Math.max((kmax - kmin) * 0.1, 3);
  const m = { l: 24, r: 24 };
  const x0 = kmin - folga;
  const x1 = kmax + folga;
  const xs = (k) => m.l + ((k - x0) / (x1 - x0)) * (W - m.l - m.r);
  const yEixo = H / 2;
  const vmax = Math.max(...s.pontos.map((p) => p.valor));
  let g = `<line class="estrada" x1="${m.l}" x2="${W - m.r}" y1="${yEixo}" y2="${yEixo}"/>`;
  for (const t of marcas(x0, x1, Math.max(2, Math.floor(W / 110)))) {
    if (t < x0 || t > x1) continue;
    g += `<line class="grade" x1="${xs(t)}" x2="${xs(t)}" y1="${yEixo - 4}" y2="${yEixo + 4}"/>`;
    g += `<text class="eixo" x="${xs(t)}" y="${H - 4}" text-anchor="middle">km ${int(t)}</text>`;
  }
  s.pontos.forEach((p, i) => {
    const r = 5 + 13 * Math.sqrt(p.valor / (vmax || 1));
    const cima = i % 2 === 0;
    const ty = cima ? yEixo - r - 22 : yEixo + r + 14;
    g += `<g data-tip="${esc(p.tip)}"><circle class="ponto-km" cx="${xs(p.km)}" cy="${yEixo}" r="${r}"/>
      <text class="rot-km" x="${xs(p.km)}" y="${ty}" text-anchor="middle">${esc(p.rotulo)}</text>
      <text class="eixo" x="${xs(p.km)}" y="${ty + 13}" text-anchor="middle">${esc(p.sub)}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.titulo || 'Posição dos equipamentos')}">${g}</svg>`;
}

// ---------- tooltip global ----------

export function iniciarTooltip() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  let alvo = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el === alvo) return;
    alvo = el;
    if (!el) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = el.dataset.tip;
    tip.hidden = false;
  });
  document.addEventListener('pointermove', (e) => {
    if (tip.hidden) return;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14;
    let y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  });
  document.addEventListener('scroll', () => {
    tip.hidden = true;
    alvo = null;
  }, true);
}
