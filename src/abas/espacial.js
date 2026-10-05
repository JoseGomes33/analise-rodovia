import { esc, int, pct, pctA, pp, dec, lista, dataBR, composicao, dissim, argmax, argmin } from '../util.js';
import { tabela, barras100, barrasH, grafKm, celPct, ativarGraficos } from '../graficos.js';

// Diferença de participação (p.p.) a partir da qual uma diferença entre equipamentos é destacada.
const DIF_PP = 0.03;
const N_PEQUENO = 100;

/** Agrega volume, dias, tipos e velocidades por grupo (equipamento, sentido ou faixa). */
function perfis(linhas, chave, ds) {
  const chT = ds.tipos.map((t) => t.chave);
  const chV = ds.velocidades.map((v) => v.chave);
  const m = new Map();
  for (const l of linhas) {
    const k = chave(l);
    let g = m.get(k);
    if (!g) {
      m.set(k, (g = { chave: k, total: 0, dias: new Set(), eqs: new Set(), t: new Map(), v: new Map() }));
    }
    g.total += l.vol;
    g.dias.add(l.dia);
    g.eqs.add(l.eq);
    g.t.set(l.tipo, (g.t.get(l.tipo) || 0) + l.vol);
    g.v.set(l.vel, (g.v.get(l.vel) || 0) + l.vol);
  }
  for (const g of m.values()) {
    g.nDias = g.dias.size;
    g.media = g.total / g.nDias;
    g.compT = composicao(g.t, chT);
    g.compV = composicao(g.v, chV);
    g.nT = Object.fromEntries(chT.map((k) => [k, g.t.get(k) || 0]));
    g.nV = Object.fromEntries(chV.map((k) => [k, g.v.get(k) || 0]));
    g.acima100 = ds.velocidades.filter((v) => v.acima100).reduce((s, v) => s + g.nV[v.chave], 0);
    g.eqs = [...g.eqs];
  }
  return m;
}

function matrizDissim(itens, campo, chaves, titulo) {
  const cel = (a, b) => {
    if (a === b) return '<td class="num diag">—</td>';
    const d = dissim(a[campo], b[campo], chaves);
    const nivel = d < 0.05 ? 1 : d < 0.1 ? 2 : d < 0.2 ? 3 : d < 0.3 ? 4 : 5;
    return `<td class="num calor c${nivel}">${pct(d)}</td>`;
  };
  return `<figure class="grafico"><figcaption>${titulo}</figcaption><div class="tabela-wrap"><table class="matriz">
    <thead><tr><th></th>${itens.map((i) => `<th class="num">${esc(i.rotulo)}</th>`).join('')}</tr></thead>
    <tbody>${itens.map((a) => `<tr><th>${esc(a.rotulo)}</th>${itens.map((b) => cel(a, b)).join('')}</tr>`).join('')}</tbody>
  </table></div></figure>`;
}

function tabelaComp(itens, series, campoComp, campoN, rotuloCol) {
  return tabela({
    cab: [rotuloCol, ...series.map((s) => `<span class="sw" style="background:${s.cor}"></span>${esc(s.nome)}`), 'Total'],
    num: [...series.map((_, i) => i + 1), series.length + 1],
    corpo: itens.map((i) => [
      `<b>${esc(i.rotulo)}</b>`,
      ...series.map((s) => celPct(i[campoComp][s.chave], i[campoN][s.chave], i[campoN][s.chave] > 0 && i[campoN][s.chave] < N_PEQUENO)),
      int(i.total),
    ]),
    legenda: `<sup>†</sup> célula com menos de ${N_PEQUENO} veículos.`,
  });
}

// ---------------- Tarefa 3: comparação entre equipamentos ----------------

function secaoEquipamentos(ds, somenteComum) {
  const T = ds.tipos;
  const V = ds.velocidades;
  const chT = T.map((t) => t.chave);
  const chV = V.map((v) => v.chave);

  let linhas = ds.linhas;
  let avisoComum = '';
  if (somenteComum) {
    const comum = new Set(ds.dias.filter((d) => ds.equipamentos.every((e) => e.dias.has(d))));
    linhas = ds.linhas.filter((l) => comum.has(l.dia));
    const dd = [...comum].sort((a, b) => a - b);
    avisoComum = comum.size
      ? `<p class="aviso">Comparação restrita a ${int(comum.size)} datas em que todos os equipamentos têm registro (${dataBR(dd[0])} a ${dataBR(dd[dd.length - 1])}).</p>`
      : '<p class="aviso">Não há nenhuma data em que todos os equipamentos tenham registro.</p>';
    if (!comum.size) return avisoComum;
  }

  const m = perfis(linhas, (l) => l.eq, ds);
  const eqs = ds.equipamentos
    .filter((e) => m.has(e.id))
    .map((e) => ({ e, rotulo: e.id, ...m.get(e.id) }));
  const total = eqs.reduce((s, x) => s + x.total, 0);

  const tabVol = tabela({
    cab: ['Equipamento', 'km', 'Município', 'Sentido / faixa', 'Dias c/ registro', 'Volume total', '% do total', 'Média diária'],
    num: [1, 4, 5, 6, 7],
    corpo: eqs.map((x) => [
      `<b>${esc(x.e.id)}</b>`,
      int(x.e.km),
      esc(x.e.municipio),
      esc(`${x.e.sentidos.join('/')} · ${x.e.faixas.join('/')}`),
      int(x.nDias),
      int(x.total),
      pct(x.total / total),
      `<b>${int(x.media)}</b>`,
    ]),
    legenda: 'A média diária divide o volume pelos dias em que o equipamento tem registro, o que permite comparar equipamentos com períodos de cobertura diferentes.',
  });

  // ----- achados -----
  const ach = [];
  const porMedia = [...eqs].sort((a, b) => b.media - a.media);
  const maxM = porMedia[0];
  const minM = porMedia[porMedia.length - 1];
  ach.push(
    `<b>Volume.</b> A média diária vai de ${int(minM.media)} veículos (${esc(minM.e.id)}) a ${int(maxM.media)} (${esc(maxM.e.id)}), uma razão de ${dec(maxM.media / minM.media, 1)} vezes. Ordem: ${porMedia
      .map((x) => `${esc(x.e.id)} ${int(x.media)}/dia`)
      .join(' > ')}.`,
  );

  const difsTipo = T.map((t) => {
    const hi = argmax(eqs, (x) => x.compT[t.chave]);
    const lo = argmin(eqs, (x) => x.compT[t.chave]);
    return { t, hi, lo, d: hi.compT[t.chave] - lo.compT[t.chave] };
  });
  const relevantes = difsTipo.filter((x) => x.d >= DIF_PP).sort((a, b) => b.d - a.d);
  if (relevantes.length) {
    ach.push(
      `<b>Composição por tipo.</b> ${relevantes
        .map((x) => `${esc(x.t.nome)}: de ${pctA(x.lo.compT[x.t.chave])} em ${esc(x.lo.e.id)} a ${pct(x.hi.compT[x.t.chave])} em ${esc(x.hi.e.id)} (${pp(x.d)})`)
        .join('; ')}.`,
    );
  }
  const ausentes = eqs.flatMap((x) => T.filter((t) => x.nT[t.chave] === 0).map((t) => `${esc(t.nome)} em ${esc(x.e.id)}`));
  if (ausentes.length) {
    ach.push(`<b>Tipos sem nenhum registro:</b> ${lista(ausentes)}. O arquivo não indica se o tipo não passou pelo equipamento ou se não foi registrado com essa classificação.`);
  }

  const modais = eqs.map((x) => ({ x, v: argmax(V, (v) => x.compV[v.chave]) }));
  const ate50 = V.filter((v) => v.hi <= 50);
  const s50 = (x) => ate50.reduce((s, v) => s + x.compV[v.chave], 0);
  ach.push(
    `<b>Distribuição de velocidade.</b> Categoria mais frequente: ${modais.map((mm) => `${esc(mm.x.e.id)} ${esc(mm.v.rotulo)} (${pct(mm.x.compV[mm.v.chave])})`).join('; ')}.
    A fração até 50 km/h varia de ${pct(Math.min(...eqs.map(s50)))} a ${pct(Math.max(...eqs.map(s50)))} (${eqs.map((x) => `${esc(x.e.id)} ${pct(s50(x))}`).join(', ')}).`,
  );

  const pares = [];
  for (let i = 0; i < eqs.length; i++) {
    for (let j = i + 1; j < eqs.length; j++) {
      pares.push({ a: eqs[i], b: eqs[j], dt: dissim(eqs[i].compT, eqs[j].compT, chT), dv: dissim(eqs[i].compV, eqs[j].compV, chV) });
    }
  }
  if (pares.length) {
    const prox = argmin(pares, (p) => p.dt + p.dv);
    const dist = argmax(pares, (p) => p.dt + p.dv);
    ach.push(
      `<b>Pares extremos.</b> Os perfis mais parecidos são ${esc(prox.a.e.id)} e ${esc(prox.b.e.id)} (dissimilaridade de ${pct(prox.dt)} na composição por tipo e ${pct(prox.dv)} na de velocidade);
      os mais diferentes são ${esc(dist.a.e.id)} e ${esc(dist.b.e.id)} (${pct(dist.dt)} e ${pct(dist.dv)}).`,
    );
  }

  const heterogeneo = pares.some((p) => p.dt >= 0.1 || p.dv >= 0.1);
  const parcial = ds.equipamentos.filter((e) => e.nDias < ds.dias.length * 0.5);
  const limites = [
    'As diferenças acima são afirmações diretas sobre volumes, participações e categorias de velocidade registrados por equipamento.',
    'O arquivo não contém informações sobre limite de velocidade, geometria da via, uso do solo, acessos ou fiscalização, por isso ele não permite atribuir causas a essas diferenças.',
  ];
  if (ds.equipamentos.every((e) => e.sentidos.length === 1)) {
    limites.push(`Cada equipamento registra um único sentido (${lista(ds.equipamentos.map((e) => `${esc(e.id)} ${esc(e.sentidos[0])}`))}); diferenças entre pontos também podem refletir o sentido monitorado, e os dados não separam os dois efeitos.`);
  }
  if (parcial.length && !somenteComum) {
    limites.push(`${lista(parcial.map((e) => `${esc(e.id)} (${dataBR(e.diaMin)} a ${dataBR(e.diaMax)})`))} cobre um período bem menor; marque a opção “somente datas comuns” para comparar no mesmo período.`);
  }

  return `
    ${avisoComum}
    <section class="bloco resposta">
      <h3>Resposta</h3>
      <p>${heterogeneo ? '<b>Sim, existem trechos com composição de tráfego diferente</b>: o perfil não é homogêneo ao longo dos pontos monitorados, tanto na composição por tipo de veículo quanto na distribuição das categorias de velocidade.' : '<b>O perfil é relativamente homogêneo</b>: nenhum par de equipamentos difere 10% ou mais em composição por tipo ou por velocidade.'}</p>
      <ul class="achados">${ach.map((a) => `<li>${a}</li>`).join('')}</ul>
      <h4>O que pode e o que não pode ser afirmado</h4>
      <ul class="achados discreto">${limites.map((l) => `<li>${l}</li>`).join('')}</ul>
    </section>

    <section class="bloco">
      ${grafKm({
        titulo: 'Posição dos equipamentos na rodovia (área do círculo ∝ média diária)',
        pontos: eqs.map((x) => ({
          km: x.e.km,
          valor: x.media,
          rotulo: x.e.id,
          sub: `km ${int(x.e.km)} · ${x.e.sentidos.join('/')}`,
          tip: `<b>${esc(x.e.id)}</b> — km ${int(x.e.km)}, ${esc(x.e.municipio)}<br>${esc(x.e.sentidos.join('/'))}, faixa ${esc(x.e.faixas.join('/'))}<br>${int(x.media)} veículos/dia`,
        })),
      })}
      ${tabVol}
    </section>

    <div class="duas-colunas">
      <section class="bloco">
        ${barras100({ titulo: 'Participação por tipo de veículo', series: T, linhas: eqs.map((x) => ({ rotulo: x.e.id, sub: `km ${int(x.e.km)}`, valores: x.nT })) })}
        ${tabelaComp(eqs, T, 'compT', 'nT', 'Equipamento')}
      </section>
      <section class="bloco">
        ${barras100({ titulo: 'Distribuição das categorias de velocidade', series: V, linhas: eqs.map((x) => ({ rotulo: x.e.id, sub: `km ${int(x.e.km)}`, valores: x.nV })) })}
        ${tabelaComp(eqs, V, 'compV', 'nV', 'Equipamento')}
      </section>
    </div>

    <div class="duas-colunas">
      <section class="bloco">${matrizDissim(eqs, 'compT', chT, 'Dissimilaridade entre equipamentos — tipo de veículo')}</section>
      <section class="bloco">${matrizDissim(eqs, 'compV', chV, 'Dissimilaridade entre equipamentos — categoria de velocidade')}</section>
    </div>
    <p class="nota">Dissimilaridade = fração do tráfego que precisaria mudar de grupo para as duas distribuições ficarem iguais (0% = idênticas, 100% = sem sobreposição).</p>
  `;
}

// ---------------- Tarefa 5: sentidos, faixas e > 100 km/h ----------------

function blocoGrupo(titulo, rotuloCol, grupos, ds) {
  const T = ds.tipos;
  const V = ds.velocidades;
  const total = grupos.reduce((s, g) => s + g.total, 0);
  return `
    <section class="bloco">
      <h3>${titulo}</h3>
      ${tabela({
        cab: [rotuloCol, 'Equipamentos', 'Dias c/ registro', 'Volume total', '% do total', 'Média diária', '> 100 km/h', '% > 100 km/h'],
        num: [2, 3, 4, 5, 6, 7],
        corpo: grupos.map((g) => [`<b>${esc(g.rotulo)}</b>`, esc(g.eqs.join(', ')), int(g.nDias), int(g.total), pct(g.total / total), int(g.media), int(g.acima100), pctA(g.acima100 / g.total)]),
      })}
      <div class="duas-colunas">
        ${barras100({ titulo: 'Composição por tipo de veículo', series: T, linhas: grupos.map((g) => ({ rotulo: g.rotulo, valores: g.nT })) })}
        ${barras100({ titulo: 'Distribuição das categorias de velocidade', series: V, linhas: grupos.map((g) => ({ rotulo: g.rotulo, valores: g.nV })) })}
      </div>
      <details class="detalhes"><summary>Tabelas de composição</summary>
        ${tabelaComp(grupos, T, 'compT', 'nT', rotuloCol)}
        ${tabelaComp(grupos, V, 'compV', 'nV', rotuloCol)}
      </details>
    </section>`;
}

function secaoOperacional(ds) {
  const T = ds.tipos;
  const V = ds.velocidades;
  const chT = T.map((t) => t.chave);
  const chV = V.map((v) => v.chave);
  const acima = V.filter((v) => v.acima100);

  const sentidos = [...perfis(ds.linhas, (l) => l.sentido, ds).values()].map((g) => ({ ...g, rotulo: g.chave })).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  const faixas = [...perfis(ds.linhas, (l) => l.faixa, ds).values()].map((g) => ({ ...g, rotulo: `Faixa ${g.chave}` })).sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true }));

  // Sentido × faixa: confundimento com equipamento?
  const cruz = new Map();
  for (const l of ds.linhas) {
    const k = `${l.sentido}|${l.faixa}`;
    cruz.set(k, (cruz.get(k) || 0) + l.vol);
  }
  const tabCruz = tabela({
    cab: ['Sentido \\ Faixa', ...faixas.map((f) => esc(f.rotulo))],
    num: faixas.map((_, i) => i + 1),
    corpo: sentidos.map((s) => [`<b>${esc(s.rotulo)}</b>`, ...faixas.map((f) => int(cruz.get(`${s.chave}|${f.chave}`) || 0))]),
  });
  const celulasCheias = [...cruz.values()].filter((v) => v > 0).length;
  const confundido = celulasCheias === Math.max(sentidos.length, faixas.length);

  const obs = [];
  if (confundido) {
    obs.push(
      `<b>Sentido, faixa e equipamento estão sobrepostos.</b> ${sentidos
        .map((s) => `${esc(s.rotulo)} aparece somente na ${esc(faixas.find((f) => cruz.get(`${s.chave}|${f.chave}`))?.rotulo.toLowerCase() ?? '')} e somente em ${lista(s.eqs.map(esc))}`)
        .join('; ')}.
      Por isso, comparar sentidos é o mesmo que comparar faixas e, também, grupos de equipamentos. As diferenças abaixo não podem ser atribuídas isoladamente ao sentido ou à faixa.`,
    );
  }
  if (sentidos.length >= 2) {
    const [a, b] = [...sentidos].sort((x, y) => y.media - x.media);
    const dt = dissim(a.compT, b.compT, chT);
    const dv = dissim(a.compV, b.compV, chV);
    const difT = argmax(T, (t) => Math.abs(a.compT[t.chave] - b.compT[t.chave]));
    const modA = argmax(V, (v) => a.compV[v.chave]);
    obs.push(
      `<b>Volume.</b> ${esc(a.rotulo)} soma ${int(a.total)} veículos (${int(a.media)}/dia, ${a.eqs.length} equipamento${a.eqs.length > 1 ? 's' : ''}) e ${esc(b.rotulo)} ${int(b.total)} (${int(b.media)}/dia, ${b.eqs.length} equipamento${b.eqs.length > 1 ? 's' : ''}).
      O volume total por sentido depende de quantos equipamentos registram cada sentido; a média diária por equipamento é ${int(a.media / a.eqs.length)} em ${esc(a.rotulo)} e ${int(b.media / b.eqs.length)} em ${esc(b.rotulo)}.`,
    );
    obs.push(
      `<b>Composição e velocidade.</b> A dissimilaridade entre os sentidos é ${pct(dt)} na composição por tipo (maior diferença em ${esc(difT.nome)}: ${pct(a.compT[difT.chave])} × ${pct(b.compT[difT.chave])}) e ${pct(dv)} na distribuição de velocidade
      (${esc(modA.rotulo)}: ${pct(a.compV[modA.chave])} em ${esc(a.rotulo)} × ${pct(b.compV[modA.chave])} em ${esc(b.rotulo)}).`,
    );
  }

  // > 100 km/h por equipamento
  const m = perfis(ds.linhas, (l) => l.eq, ds);
  const eqs = ds.equipamentos.map((e) => ({ e, ...m.get(e.id) })).map((x) => ({ ...x, prop: x.acima100 / x.total, porDia: x.acima100 / x.nDias }));
  const rankAbs = [...eqs].sort((a, b) => b.acima100 - a.acima100);
  const rankProp = [...eqs].sort((a, b) => b.prop - a.prop);
  const topAbs = rankAbs[0];
  const topProp = rankProp[0];
  const pos = (arr, x) => arr.indexOf(x) + 1;

  const tab100 = tabela({
    cab: ['Equipamento', 'Dias c/ registro', 'Volume total', ...acima.map((v) => esc(v.rotulo)), 'Total > 100 km/h', 'Ranking absoluto', '% do próprio volume', 'Ranking proporcional', 'Por dia'],
    num: [1, 2, ...acima.map((_, i) => i + 3), acima.length + 3, acima.length + 4, acima.length + 5, acima.length + 6, acima.length + 7],
    corpo: eqs.map((x) => [
      `<b>${esc(x.e.id)}</b> <small>km ${int(x.e.km)}</small>`,
      int(x.nDias),
      int(x.total),
      ...acima.map((v) => int(x.nV[v.chave])),
      `<b>${int(x.acima100)}</b>`,
      `${pos(rankAbs, x)}º`,
      `<b>${pctA(x.prop)}</b>`,
      `${pos(rankProp, x)}º`,
      dec(x.porDia, 2),
    ]),
  });

  const mesmo = topAbs === topProp;
  const razaoVol = topAbs.total / topProp.total;
  const explic = mesmo
    ? `<p>Neste arquivo, o mesmo equipamento (${esc(topAbs.e.id)}) lidera os dois rankings, mas as medidas continuam diferentes: ${int(topAbs.acima100)} é uma contagem e ${pctA(topAbs.prop)} é uma razão sobre ${int(topAbs.total)} veículos.</p>`
    : `<p><b>${esc(topAbs.e.id)}</b> tem a maior quantidade (${int(topAbs.acima100)} veículos), mas também o maior denominador: ${int(topAbs.total)} veículos no total, ${dec(razaoVol, 1)} vezes o volume de ${esc(topProp.e.id)}. Por isso, sua proporção é de apenas ${pctA(topAbs.prop)} (${pos(rankProp, topAbs)}º lugar no ranking proporcional).</p>
       <p><b>${esc(topProp.e.id)}</b> registrou ${int(topProp.acima100)} veículos acima de 100 km/h (${pos(rankAbs, topProp)}º no ranking absoluto), mas sobre um total de apenas ${int(topProp.total)} veículos, o que resulta em ${pctA(topProp.prop)} — ${dec(topProp.prop / topAbs.prop, 1)} vezes a proporção de ${esc(topAbs.e.id)}.${
         topProp.nDias < topAbs.nDias * 0.5 ? ` Esse equipamento também tem apenas ${int(topProp.nDias)} dias de registro (contra ${int(topAbs.nDias)}), o que reduz ainda mais a sua soma absoluta.` : ''
       }</p>`;
  const explicDia = `<p>Uma terceira medida, a média de veículos acima de 100 km/h por dia de registro, neutraliza a diferença de período, mas não a de volume de tráfego:
    ${[...eqs].sort((a, b) => b.porDia - a.porDia).map((x) => `${esc(x.e.id)} ${dec(x.porDia, 2)}/dia`).join(' > ')}.
    Cada medida responde a uma pergunta diferente, e o ranking muda conforme o denominador escolhido.</p>`;

  return `
    <section class="bloco resposta">
      <h3>Sentidos e faixas: o que os dados mostram</h3>
      <ul class="achados">${obs.map((o) => `<li>${o}</li>`).join('')}</ul>
      <h4>Volume por sentido × faixa</h4>
      ${tabCruz}
    </section>

    ${blocoGrupo('Sentidos de circulação', 'Sentido', sentidos, ds)}
    ${blocoGrupo('Faixas da pista', 'Faixa', faixas, ds)}

    <section class="bloco resposta">
      <h3>Veículos nas categorias acima de 100 km/h</h3>
      <ul class="achados">
        <li><b>Maior volume absoluto acima de 100 km/h:</b> ${esc(topAbs.e.id)} (km ${int(topAbs.e.km)}), com ${int(topAbs.acima100)} veículos.</li>
        <li><b>Maior proporção acima de 100 km/h em relação ao próprio volume:</b> ${esc(topProp.e.id)} (km ${int(topProp.e.km)}), com ${pctA(topProp.prop)} (${int(topProp.acima100)} de ${int(topProp.total)} veículos).</li>
      </ul>
      ${explic}
      ${explicDia}
      <h4>Por que quantidade absoluta e proporção não são a mesma medida</h4>
      <ul class="achados discreto">
        <li>A quantidade absoluta responde “quantos veículos foram registrados acima de 100 km/h”. Ela cresce com o volume de tráfego do ponto e com o número de dias de registro, mesmo que o comportamento dos condutores não mude.</li>
        <li>A proporção responde “que fração do tráfego daquele ponto estava acima de 100 km/h”. Ela neutraliza o tamanho do fluxo e o período, mas não diz quantos veículos estão envolvidos.</li>
        <li>Rankings diferentes não são contraditórios: um ponto com muito tráfego pode ter muitos casos e baixa proporção; um ponto com pouco tráfego pode ter poucos casos e alta proporção.</li>
        <li>Proporções calculadas sobre poucos casos (aqui, centenas de veículos em milhões) são sensíveis: alguns veículos a mais ou a menos mudam bastante o percentual. As duas medidas devem ser apresentadas juntas.</li>
      </ul>
    </section>

    <div class="duas-colunas">
      <section class="bloco">
        ${barrasH({
          titulo: 'Quantidade absoluta acima de 100 km/h',
          linhas: rankAbs.map((x) => ({ rotulo: x.e.id, valor: x.acima100, texto: int(x.acima100), destaque: x === topAbs, tip: `<b>${esc(x.e.id)}</b><br>${int(x.acima100)} veículos acima de 100 km/h` })),
        })}
      </section>
      <section class="bloco">
        ${barrasH({
          titulo: 'Proporção do próprio volume acima de 100 km/h',
          linhas: rankProp.map((x) => ({ rotulo: x.e.id, valor: x.prop, texto: pctA(x.prop), destaque: x === topProp, tip: `<b>${esc(x.e.id)}</b><br>${pctA(x.prop)} — ${int(x.acima100)} de ${int(x.total)} veículos` })),
        })}
      </section>
    </div>

    <section class="bloco">
      <h3>Detalhamento por equipamento</h3>
      ${tab100}
    </section>
  `;
}

export function renderEspacial(el, ds) {
  el.innerHTML = `
    <header class="aba-cab">
      <h2>Análise espacial e operacional</h2>
      <p class="pergunta">O perfil do tráfego é homogêneo ao longo dos pontos monitorados? Como se comportam sentidos, faixas e velocidades acima de 100 km/h?</p>
    </header>
    <div class="segmentado" role="tablist" aria-label="Seções">
      <button type="button" role="tab" aria-selected="true" data-sec="eq">Comparação entre equipamentos</button>
      <button type="button" role="tab" aria-selected="false" data-sec="op">Sentidos, faixas e &gt; 100 km/h</button>
    </div>
    <div data-painel="eq">
      <div class="filtros"><label class="check"><input type="checkbox" id="so-comum"> Somente datas em que todos os equipamentos têm registro</label></div>
      <div id="sec-eq"></div>
    </div>
    <div data-painel="op" hidden>${secaoOperacional(ds)}</div>
  `;
  const alvo = el.querySelector('#sec-eq');
  const chk = el.querySelector('#so-comum');
  const desenhar = () => {
    alvo.innerHTML = secaoEquipamentos(ds, chk.checked);
    ativarGraficos(alvo);
  };
  chk.addEventListener('change', desenhar);
  desenhar();
  el.querySelectorAll('.segmentado button').forEach((b) =>
    b.addEventListener('click', () => {
      el.querySelectorAll('.segmentado button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      el.querySelectorAll('[data-painel]').forEach((p) => (p.hidden = p.dataset.painel !== b.dataset.sec));
      ativarGraficos(el);
    }),
  );
  ativarGraficos(el);
}
