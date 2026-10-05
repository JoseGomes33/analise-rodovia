// Leitura, validação e normalização do CSV de radares da ANTT.

const COLUNAS = [
  'concessionaria', 'identificador', 'rodovia', 'uf', 'km_m', 'municipio', 'tipo_de_pista',
  'latitude', 'longitude', 'data_da_passagem', 'sentido_da_passagem', 'faixa_da_passagem',
  'velocidade', 'tipo_de_veiculo', 'volume_total',
];

// Ordem e cores fixas por tipo de veículo (a cor acompanha o tipo em todas as abas).
const ORDEM_TIPOS = ['Passeio', 'Comercial', 'Moto', 'Não classificado'];
const SLOTS_TIPO = 8;

/** Decodifica como UTF-8; se o arquivo não for UTF-8 válido, usa ISO-8859-1 (padrão dos dados da ANTT). */
export function decodificar(buffer) {
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    texto = new TextDecoder('iso-8859-1').decode(buffer);
  }
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

export async function carregarDeUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return decodificar(await resp.arrayBuffer());
}

export async function lerArquivo(arquivo) {
  return decodificar(await arquivo.arrayBuffer());
}

function dividir(linha, sep) {
  if (linha.indexOf('"') === -1) return linha.split(sep);
  const out = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else aspas = false;
      } else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      out.push(atual);
      atual = '';
    } else atual += c;
  }
  out.push(atual);
  return out;
}

function numero(s) {
  const t = String(s).trim();
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

const cacheDatas = new Map();
function lerData(s) {
  if (cacheDatas.has(s)) return cacheDatas.get(s);
  let d, m, a;
  let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (r) [d, m, a] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) [a, m, d] = [+r[1], +r[2], +r[3]];
  let res = null;
  if (r) {
    const t = Date.UTC(a, m - 1, d);
    res = { dia: t / 86400000, dow: new Date(t).getUTCDay(), mes: `${a}-${String(m).padStart(2, '0')}` };
  }
  cacheDatas.set(s, res);
  return res;
}

/**
 * Interpreta rótulos como "<= 20 KM/h", "21 - 50 KM", "81 - 100 K" (truncado no arquivo),
 * "101 - 120 " e "> 160 KM/h". Retorna limites numéricos e um rótulo padronizado.
 */
function lerVelocidade(bruto) {
  const s = bruto.trim();
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (!nums.length) return { chave: s || '(vazio)', rotulo: s || '(vazio)', lo: Infinity, hi: Infinity };
  if (/^(<=|≤|<|até)/i.test(s)) return { chave: `<=${nums[0]}`, rotulo: `≤ ${nums[0]} km/h`, lo: 0, hi: nums[0] };
  if (/^(>=|≥|>|acima)/i.test(s)) return { chave: `>${nums[0]}`, rotulo: `> ${nums[0]} km/h`, lo: nums[0], hi: Infinity };
  if (nums.length >= 2) return { chave: `${nums[0]}-${nums[1]}`, rotulo: `${nums[0]}–${nums[1]} km/h`, lo: nums[0], hi: nums[1] };
  return { chave: s, rotulo: s, lo: nums[0], hi: nums[0] };
}

// Rampas ordinais: azul para até 100 km/h, laranja para acima de 100 km/h.
const RAMPA_ATE100 = [
  ['#86b6ef', '#0b0b0b'], ['#5598e7', '#0b0b0b'], ['#2a78d6', '#ffffff'], ['#184f95', '#ffffff'],
  ['#0d366b', '#ffffff'],
];
const RAMPA_ACIMA100 = [
  ['#f5b08c', '#0b0b0b'], ['#eb6834', '#0b0b0b'], ['#b9481b', '#ffffff'], ['#7d2e0e', '#ffffff'],
  ['#561f08', '#ffffff'],
];

function escolher(rampa, i, n) {
  if (n <= 1) return rampa[Math.min(2, rampa.length - 1)];
  return rampa[Math.round((i * (Math.min(n, rampa.length) - 1)) / (n - 1))];
}

/**
 * Transforma o texto do CSV em um conjunto de dados normalizado e pré-agregado.
 * Lança erro com mensagem amigável se as colunas esperadas não existirem.
 */
export function prepararDados(texto, nomeArquivo = '') {
  const linhasTexto = texto.split(/\r?\n/);
  const cabecalho = linhasTexto[0] || '';
  const sep = (cabecalho.match(/;/g) || []).length >= (cabecalho.match(/,/g) || []).length ? ';' : ',';
  const nomes = dividir(cabecalho, sep).map((c) => c.trim().toLowerCase());
  const idx = Object.fromEntries(COLUNAS.map((c) => [c, nomes.indexOf(c)]));
  const faltando = COLUNAS.filter((c) => idx[c] === -1);
  if (faltando.length) throw new Error(`Colunas ausentes no arquivo: ${faltando.join(', ')}`);

  const equipamentos = new Map();
  const velocidades = new Map();
  const tipos = new Map();
  const linhas = [];
  let ignoradas = 0;

  for (let i = 1; i < linhasTexto.length; i++) {
    const bruta = linhasTexto[i];
    if (!bruta.trim()) continue;
    const c = dividir(bruta, sep);
    const data = lerData((c[idx.data_da_passagem] || '').trim());
    const vol = numero(c[idx.volume_total]);
    const eq = (c[idx.identificador] || '').trim();
    if (!data || !Number.isFinite(vol) || !eq) {
      ignoradas++;
      continue;
    }

    if (!equipamentos.has(eq)) {
      equipamentos.set(eq, {
        id: eq,
        concessionaria: c[idx.concessionaria].trim(),
        rodovia: c[idx.rodovia].trim(),
        uf: c[idx.uf].trim(),
        km: numero(c[idx.km_m]),
        municipio: c[idx.municipio].trim(),
        pista: c[idx.tipo_de_pista].trim(),
        lat: numero(c[idx.latitude]),
        lon: numero(c[idx.longitude]),
        volume: 0,
        dias: new Set(),
        sentidos: new Set(),
        faixas: new Set(),
      });
    }
    const e = equipamentos.get(eq);

    const velBruta = c[idx.velocidade];
    let v = velocidades.get(velBruta);
    if (!v) {
      const info = lerVelocidade(velBruta);
      v = [...velocidades.values()].find((x) => x.chave === info.chave);
      if (!v) v = { ...info, brutos: new Set(), volume: 0 };
      v.brutos.add(velBruta);
      velocidades.set(velBruta, v);
    }

    const tipo = (c[idx.tipo_de_veiculo] || '').trim() || '(vazio)';
    if (!tipos.has(tipo)) tipos.set(tipo, { chave: tipo, nome: tipo, volume: 0 });

    const sentido = (c[idx.sentido_da_passagem] || '').trim() || '(vazio)';
    const faixa = (c[idx.faixa_da_passagem] || '').trim() || '(vazio)';

    e.volume += vol;
    e.dias.add(data.dia);
    e.sentidos.add(sentido);
    e.faixas.add(faixa);
    v.volume += vol;
    tipos.get(tipo).volume += vol;

    linhas.push({ eq, dia: data.dia, dow: data.dow, mes: data.mes, sentido, faixa, vel: v.chave, tipo, vol });
  }

  if (!linhas.length) throw new Error('Nenhuma linha válida encontrada no arquivo.');

  // Categorias de velocidade ordenadas pelo limite inferior, com cores ordinais.
  const listaVel = [...new Map([...velocidades.values()].map((v) => [v.chave, v])).values()].sort(
    (a, b) => a.lo - b.lo || a.hi - b.hi,
  );
  const ate = listaVel.filter((v) => !(v.lo >= 100));
  const acima = listaVel.filter((v) => v.lo >= 100);
  ate.forEach((v, i) => {
    v.acima100 = false;
    [v.cor, v.tinta] = escolher(RAMPA_ATE100, i, ate.length);
  });
  acima.forEach((v, i) => {
    v.acima100 = true;
    [v.cor, v.tinta] = escolher(RAMPA_ACIMA100, i, acima.length);
  });
  listaVel.forEach((v) => {
    v.nome = v.rotulo;
    v.brutos = [...v.brutos].map((b) => b.trim());
  });

  const listaTipos = [...tipos.values()].sort((a, b) => {
    const ia = ORDEM_TIPOS.indexOf(a.chave);
    const ib = ORDEM_TIPOS.indexOf(b.chave);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.volume - a.volume;
  });
  listaTipos.forEach((t, i) => {
    t.cor = i < SLOTS_TIPO ? `var(--serie-${i + 1})` : 'var(--serie-outro)';
    t.tinta = `var(--serie-${Math.min(i + 1, SLOTS_TIPO)}-tinta)`;
  });

  const listaEq = [...equipamentos.values()].sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));
  for (const e of listaEq) {
    const d = [...e.dias].sort((a, b) => a - b);
    e.nDias = d.length;
    e.diaMin = d[0];
    e.diaMax = d[d.length - 1];
    e.sentidos = [...e.sentidos].sort();
    e.faixas = [...e.faixas].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }

  const dias = [...new Set(linhas.map((l) => l.dia))].sort((a, b) => a - b);
  const total = linhas.reduce((s, l) => s + l.vol, 0);
  const ordenar = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  return {
    nomeArquivo,
    linhas,
    ignoradas,
    total,
    dias,
    equipamentos: listaEq,
    velocidades: listaVel,
    tipos: listaTipos,
    sentidos: ordenar(linhas.map((l) => l.sentido)),
    faixas: ordenar(linhas.map((l) => l.faixa)),
    rodovias: ordenar(listaEq.map((e) => e.rodovia)),
    ufs: ordenar(listaEq.map((e) => e.uf)),
    municipios: ordenar(listaEq.map((e) => e.municipio)),
    concessionarias: ordenar(listaEq.map((e) => e.concessionaria)),
    pistas: ordenar(listaEq.map((e) => e.pista)),
  };
}
