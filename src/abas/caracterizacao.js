import { esc, int, pct, pctA, dataBR, lista, somaPor, pad } from '../util.js';
import { tile, tabela, barrasH } from '../graficos.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function chips(itens) {
  return `<ul class="chips">${itens.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/** Intervalos de dias consecutivos sem nenhum registro. */
function lacunas(dias) {
  const out = [];
  for (let i = 1; i < dias.length; i++) {
    if (dias[i] - dias[i - 1] > 1) out.push({ ini: dias[i - 1] + 1, fim: dias[i] - 1, n: dias[i] - dias[i - 1] - 1 });
  }
  return out;
}

function gradeCobertura(ds) {
  const ini = new Date(ds.dias[0] * 86400000);
  const fim = new Date(ds.dias[ds.dias.length - 1] * 86400000);
  const meses = [];
  let a = ini.getUTCFullYear();
  let m = ini.getUTCMonth();
  while (a < fim.getUTCFullYear() || (a === fim.getUTCFullYear() && m <= fim.getUTCMonth())) {
    meses.push({ chave: `${a}-${pad(m + 1)}`, a, m, nDias: new Date(Date.UTC(a, m + 1, 0)).getUTCDate() });
    if (++m === 12) {
      m = 0;
      a++;
    }
  }
  const contagem = new Map();
  for (const e of ds.equipamentos) {
    for (const d of e.dias) {
      const dt = new Date(d * 86400000);
      const k = `${e.id}|${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
      contagem.set(k, (contagem.get(k) || 0) + 1);
    }
  }
  const nivel = (f) => (f === 0 ? 0 : f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.75 ? 3 : f < 1 ? 4 : 5);
  const cols = `grid-template-columns: 4.5rem repeat(${meses.length}, minmax(9px, 1fr))`;
  let html = `<div class="cobertura" style="${cols}"><span></span>`;
  for (const mm of meses) html += `<span class="cob-ano">${mm.m === 0 || mm === meses[0] ? mm.a : ''}</span>`;
  for (const e of ds.equipamentos) {
    html += `<span class="cob-rot">${esc(e.id)}</span>`;
    for (const mm of meses) {
      const n = contagem.get(`${e.id}|${mm.chave}`) || 0;
      const tip = `<b>${esc(e.id)} · ${MESES[mm.m]}/${mm.a}</b><br>${n} de ${mm.nDias} dias com registro`;
      html += `<span class="cob-cel n${nivel(n / mm.nDias)}" data-tip="${esc(tip)}"></span>`;
    }
  }
  html += '</div>';
  const leg = ['sem registro', '< 25%', '25–50%', '50–75%', '75–99%', 'mês completo']
    .map((t, i) => `<li><span class="cob-cel n${i}"></span>${t}</li>`)
    .join('');
  return `<figure class="grafico"><figcaption>Dias com registro por mês e equipamento</figcaption>
    <ul class="legenda">${leg}</ul><div class="rolagem-x">${html}</div></figure>`;
}

export function renderCaracterizacao(el, ds) {
  const { total, dias, equipamentos: eqs } = ds;
  const diaIni = dias[0];
  const diaFim = dias[dias.length - 1];
  const nIntervalo = diaFim - diaIni + 1;
  const buracos = lacunas(dias);
  const faltantes = nIntervalo - dias.length;

  const porTipo = somaPor(ds.linhas, (l) => l.tipo);
  const porVel = somaPor(ds.linhas, (l) => l.vel);
  const porSentido = somaPor(ds.linhas, (l) => l.sentido);
  const porFaixa = somaPor(ds.linhas, (l) => l.faixa);
  const regTipo = new Map();
  for (const l of ds.linhas) regTipo.set(l.tipo, (regTipo.get(l.tipo) || 0) + 1);

  const eqsDe = (campo, valor) => eqs.filter((e) => e[campo].includes(valor)).map((e) => e.id);
  const umSentidoUmaFaixa = eqs.every((e) => e.sentidos.length === 1 && e.faixas.length === 1);

  // ----- observações geradas a partir do arquivo -----
  const obs = [];
  if (faltantes > 0) {
    const maiores = [...buracos].sort((a, b) => b.n - a.n).slice(0, 3);
    obs.push(
      `${int(faltantes)} dos ${int(nIntervalo)} dias do intervalo não têm nenhum registro. Maiores lacunas: ${lista(
        maiores.map((b) => (b.n === 1 ? dataBR(b.ini) : `${dataBR(b.ini)} a ${dataBR(b.fim)} (${int(b.n)} dias)`)),
      )}.`,
    );
  }
  const parciais = eqs.filter((e) => e.nDias < dias.length * 0.5);
  for (const e of parciais) {
    obs.push(
      `O equipamento <b>${esc(e.id)}</b> tem registros em apenas ${int(e.nDias)} dias (${dataBR(e.diaMin)} a ${dataBR(e.diaMax)}). Somas absolutas desse equipamento não são comparáveis às dos demais sem considerar o número de dias.`,
    );
  }
  if (umSentidoUmaFaixa) {
    obs.push(
      `Cada equipamento registra um único sentido e uma única faixa (${lista(
        eqs.map((e) => `${esc(e.id)}: ${esc(e.sentidos[0])}, faixa ${esc(e.faixas[0])}`),
      )}). Comparações entre sentidos ou entre faixas são, portanto, também comparações entre equipamentos.`,
    );
  }
  const truncados = ds.velocidades.filter((v) => v.brutos.some((b) => !/km\/h$/i.test(b)));
  if (truncados.length) {
    obs.push(
      `Os rótulos de velocidade aparecem abreviados ou truncados no arquivo (ex.: ${lista(
        truncados.slice(0, 3).map((v) => `“${esc(v.brutos[0])}”`),
      )}) e foram padronizados pelo intervalo numérico (coluna “Rótulo no arquivo” abaixo).`,
    );
  }
  if (ds.ignoradas) obs.push(`${int(ds.ignoradas)} linhas foram ignoradas por data, identificador ou volume inválidos.`);

  const tabEq = tabela({
    cab: ['Equipamento', 'km', 'Município', 'UF', 'Sentido', 'Faixa', 'Primeiro dia', 'Último dia', 'Dias c/ registro', 'Volume', '% do total'],
    num: [1, 8, 9, 10],
    corpo: eqs.map((e) => [
      `<b>${esc(e.id)}</b>`,
      int(e.km),
      esc(e.municipio),
      esc(e.uf),
      esc(e.sentidos.join(', ')),
      esc(e.faixas.join(', ')),
      dataBR(e.diaMin),
      dataBR(e.diaMax),
      int(e.nDias),
      int(e.volume),
      pct(e.volume / total),
    ]),
  });

  const linhasTipo = ds.tipos.map((t) => ({ t, v: porTipo.get(t.chave) || 0 }));
  const tabTipos = tabela({
    cab: ['Tipo de veículo', 'Volume', '%', 'Registros'],
    num: [1, 2, 3],
    corpo: linhasTipo.map(({ t, v }) => [`<span class="sw" style="background:${t.cor}"></span>${esc(t.nome)}`, int(v), pct(v / total), int(regTipo.get(t.chave) || 0)]),
    rodape: ['Total', int(total), '100%', int(ds.linhas.length)],
  });

  const tabVel = tabela({
    cab: ['Categoria', 'Rótulo no arquivo', 'Volume', '%'],
    num: [2, 3],
    corpo: ds.velocidades.map((v) => [
      `<span class="sw" style="background:${v.cor}"></span>${esc(v.rotulo)}`,
      `<code>${esc(v.brutos.join(' | '))}</code>`,
      int(porVel.get(v.chave) || 0),
      pctA((porVel.get(v.chave) || 0) / total),
    ]),
  });

  const tabSF = (titulo, valores, mapa, campo) =>
    tabela({
      cab: [titulo, 'Volume', '%', 'Equipamentos'],
      num: [1, 2],
      corpo: valores.map((s) => [esc(s), int(mapa.get(s) || 0), pct((mapa.get(s) || 0) / total), esc(eqsDe(campo, s).join(', '))]),
    });

  el.innerHTML = `
    <header class="aba-cab">
      <h2>Caracterização do conjunto de dados</h2>
      <p>Tráfego registrado pelos radares de controle de velocidade da ${esc(lista(ds.rodovias))} no Sistema de Informação de Rodovias da ANTT.
      Cada linha do arquivo agrega o volume por equipamento, data, sentido, faixa, categoria de velocidade e tipo de veículo.</p>
    </header>

    <div class="tiles">
      ${tile('Volume total registrado', int(total), 'veículos', true)}
      ${tile('Período analisado', `${dataBR(diaIni)} – ${dataBR(diaFim)}`, `${int(dias.length)} dias com registro de ${int(nIntervalo)} no intervalo`)}
      ${tile('Equipamentos', int(eqs.length), esc(lista(eqs.map((e) => e.id))))}
      ${tile('Registros (linhas)', int(ds.linhas.length), esc(ds.nomeArquivo))}
    </div>

    <section class="bloco">
      <h3>Localização</h3>
      <dl class="fatos">
        <dt>Rodovia(s)</dt><dd>${chips(ds.rodovias.map(esc))}</dd>
        <dt>Estado(s)</dt><dd>${chips(ds.ufs.map(esc))}</dd>
        <dt>Município(s)</dt><dd>${chips(ds.municipios.map((m) => `${esc(m)} <small>${esc(eqs.filter((e) => e.municipio === m).map((e) => e.id).join(', '))}</small>`))}</dd>
        <dt>Concessionária</dt><dd>${chips(ds.concessionarias.map(esc))}</dd>
        <dt>Tipo de pista</dt><dd>${chips(ds.pistas.map(esc))}</dd>
      </dl>
    </section>

    <section class="bloco">
      <h3>Equipamentos</h3>
      ${tabEq}
    </section>

    <div class="duas-colunas">
      <section class="bloco">
        <h3>Tipos de veículos</h3>
        ${barrasH({ linhas: linhasTipo.map(({ t, v }) => ({ rotulo: t.nome, valor: v, texto: pct(v / total), cor: t.cor })) })}
        ${tabTipos}
      </section>
      <section class="bloco">
        <h3>Categorias de velocidade</h3>
        ${barrasH({ linhas: ds.velocidades.map((v) => ({ rotulo: v.rotulo, valor: porVel.get(v.chave) || 0, texto: pctA((porVel.get(v.chave) || 0) / total), cor: v.cor, tip: `<b>${esc(v.rotulo)}</b><br>${int(porVel.get(v.chave) || 0)} veículos` })) })}
        ${tabVel}
      </section>
    </div>

    <div class="duas-colunas">
      <section class="bloco"><h3>Sentidos de passagem</h3>${tabSF('Sentido', ds.sentidos, porSentido, 'sentidos')}</section>
      <section class="bloco"><h3>Faixas de passagem</h3>${tabSF('Faixa', ds.faixas, porFaixa, 'faixas')}</section>
    </div>

    <section class="bloco">
      <h3>Cobertura temporal</h3>
      ${gradeCobertura(ds)}
    </section>

    ${obs.length ? `<section class="bloco destaque-bloco"><h3>Observações sobre o arquivo</h3><ul class="achados">${obs.map((o) => `<li>${o}</li>`).join('')}</ul></section>` : ''}
  `;
}
