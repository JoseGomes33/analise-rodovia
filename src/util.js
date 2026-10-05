// Formatação (pt-BR) e agregações genéricas usadas por todas as abas.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatos = new Map();
function nf(min, max) {
  const k = `${min}-${max}`;
  if (!formatos.has(k)) {
    formatos.set(k, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return formatos.get(k);
}

export const int = (n) => nf(0, 0).format(Math.round(n));
export const dec = (n, d = 1) => nf(d, d).format(n);
export const pct = (x, d = 1) => `${nf(d, d).format(x * 100)}%`;
export const pp = (x, d = 1) => `${nf(d, d).format(x * 100)} p.p.`;

/** Percentual com casas decimais suficientes para não exibir "0,0%" em valores positivos. */
export function pctA(x) {
  if (!x) return '0%';
  const a = Math.abs(x) * 100;
  if (a >= 1) return pct(x, 1);
  // duas casas significativas: 0,72% · 0,018% · 0,00022%
  return pct(x, Math.min(8, Math.ceil(-Math.log10(a)) + 1));
}

/** Variação percentual com sinal explícito. */
export const variacao = (x, d = 1) => !Number.isFinite(x) ? "—" : `${x > 0 ? '+' : x < 0 ? '−' : ''}${nf(d, d).format(Math.abs(x * 100))}%`;

export function compacto(n) {
  if (Math.abs(n) >= 1e6) return `${dec(n / 1e6, 1)} mi`;
  if (Math.abs(n) >= 1e4) return `${dec(n / 1e3, 1)} mil`;
  return int(n);
}

export const pad = (n) => String(n).padStart(2, '0');

/** `dia` = dias desde 1970-01-01 (UTC). */
export function dataBR(dia) {
  const d = new Date(dia * 86400000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Segunda → domingo. */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** "A", "A e B", "A, B e C". */
export function lista(itens) {
  const a = [...itens];
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}`;
}

export function somaPor(linhas, f) {
  const m = new Map();
  for (const l of linhas) {
    const k = f(l);
    m.set(k, (m.get(k) || 0) + l.vol);
  }
  return m;
}

/** Tabela cruzada: linha → { total, c: Map(coluna → volume) }. */
export function cruzar(linhas, fLinha, fColuna) {
  const m = new Map();
  for (const l of linhas) {
    const a = fLinha(l);
    let r = m.get(a);
    if (!r) m.set(a, (r = { total: 0, c: new Map() }));
    r.total += l.vol;
    const b = fColuna(l);
    r.c.set(b, (r.c.get(b) || 0) + l.vol);
  }
  return m;
}

/** Participação de cada chave no total das chaves informadas. */
export function composicao(mapa, chaves) {
  let t = 0;
  for (const k of chaves) t += mapa.get(k) || 0;
  const o = {};
  for (const k of chaves) o[k] = t ? (mapa.get(k) || 0) / t : 0;
  return o;
}

/**
 * Índice de dissimilaridade (distância de variação total) entre duas composições:
 * 0 = idênticas; 1 = sem nenhuma sobreposição. Equivale à fração do tráfego que
 * precisaria "mudar de grupo" para as duas distribuições ficarem iguais.
 */
export function dissim(a, b, chaves) {
  let s = 0;
  for (const k of chaves) s += Math.abs((a[k] || 0) - (b[k] || 0));
  return s / 2;
}

export function argmax(itens, f) {
  let melhor = null;
  let v = -Infinity;
  for (const it of itens) {
    const x = f(it);
    if (x > v) {
      v = x;
      melhor = it;
    }
  }
  return melhor;
}

export function argmin(itens, f) {
  return argmax(itens, (it) => -f(it));
}
