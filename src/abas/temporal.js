import { esc, int, pct, pp, dec, variacao, lista, DIAS, DIAS_CURTOS, ORDEM_SEMANA, argmax, argmin, dissim } from '../util.js';
import { tabela, barras100, barrasH, grafLinhas, ativarGraficos } from '../graficos.js';

const UTEIS = [1, 2, 3, 4, 5];
const FDS = [6, 0];

/** Média diária por dia da semana: soma de cada data, depois média entre as datas do mesmo dia da semana. */
function calcular(linhas, tipos) {
  const chT = tipos.map((t) => t.chave);
  const porData = new Map();
  for (const l of linhas) {
    let d = porData.get(l.dia);
    if (!d) porData.set(l.dia, (d = { dow: l.dow, total: 0, t: Object.fromEntries(chT.map((k) => [k, 0])) }));
    d.total += l.vol;
    d.t[l.tipo] += l.vol;
  }
  const sem = Array.from({ length: 7 }, (_, dow) => ({ dow, n: 0, soma: 0, t: Object.fromEntries(chT.map((k) => [k, 0])) }));
  for (const d of porData.values()) {
    const s = sem[d.dow];
    s.n++;
    s.soma += d.total;
    for (const k of chT) s.t[k] += d.t[k];
  }
  for (const s of sem) {
    s.media = s.n ? s.soma / s.n : NaN;
    s.mt = Object.fromEntries(chT.map((k) => [k, s.n ? s.t[k] / s.n : NaN]));
  }
  const nDatas = porData.size;
  const somaT = Object.fromEntries(chT.map((k) => [k, sem.reduce((a, s) => a + s.t[k], 0)]));
  const mediaGeralT = Object.fromEntries(chT.map((k) => [k, somaT[k] / nDatas]));
  const mediaGeral = sem.reduce((a, s) => a + s.soma, 0) / nDatas;

  const transicoes = ORDEM_SEMANA.map((a, i) => {
    const b = ORDEM_SEMANA[(i + 1) % 7];
    const A = sem[a];
    const B = sem[b];
    const delta = B.media - A.media;
    return {
      a,
      b,
      delta,
      var: delta / A.media,
      tipos: Object.fromEntries(chT.map((k) => {
        const dk = B.mt[k] - A.mt[k];
        return [k, { delta: dk, var: A.mt[k] ? dk / A.mt[k] : NaN, contrib: delta ? dk / delta : NaN, partBase: A.mt[k] / A.media }];
      })),
    };
  });

  const grupo = (dows) => {
    const ss = dows.map((d) => sem[d]);
    const n = ss.reduce((a, s) => a + s.n, 0);
    const vol = Object.fromEntries(chT.map((k) => [k, ss.reduce((a, s) => a + s.t[k], 0)]));
    const tot = chT.reduce((a, k) => a + vol[k], 0);
    return { n, media: tot / n, mt: Object.fromEntries(chT.map((k) => [k, vol[k] / n])), comp: Object.fromEntries(chT.map((k) => [k, vol[k] / tot])), vol };
  };

  return { sem, nDatas, mediaGeral, mediaGeralT, transicoes, uteis: grupo(UTEIS), fds: grupo(FDS) };
}

function conteudo(ds, linhas, rotuloFiltro, filtro) {
  const T = ds.tipos;
  const chT = T.map((t) => t.chave);
  const r = calcular(linhas, T);
  const validos = ORDEM_SEMANA.filter((d) => r.sem[d].n > 0);
  if (validos.length < 7) return `<p class="aviso">Não há registros em todos os dias da semana para ${esc(rotuloFiltro)}.</p>`;
  const maior = argmax(validos, (d) => r.sem[d].media);
  const menor = argmin(validos, (d) => r.sem[d].media);
  const tMax = argmax(r.transicoes, (t) => t.var);
  const tFim = r.transicoes.find((t) => t.b === maior);
  const nome = (d) => DIAS[d];
  const trans = (t) => `${DIAS_CURTOS[t.a]} → ${DIAS_CURTOS[t.b]}`;

  // ----- tabela por dia -----
  const tabDias = tabela({
    cab: ['Dia da semana', 'Datas no período', 'Volume acumulado', 'Média diária', 'vs. média geral', ...T.map((t) => `<span class="sw" style="background:${t.cor}"></span>${esc(t.nome)}`)],
    num: [1, 2, 3, 4, ...T.map((_, i) => i + 5)],
    corpo: ORDEM_SEMANA.map((d) => {
      const s = r.sem[d];
      return {
        classe: d === maior ? 'linha-max' : d === menor ? 'linha-min' : '',
        celulas: [
          `<b>${DIAS[d]}</b>${d === maior ? '<span class="etiqueta">maior</span>' : d === menor ? '<span class="etiqueta">menor</span>' : ''}`,
          int(s.n),
          int(s.soma),
          `<b>${int(s.media)}</b>`,
          variacao(s.media / r.mediaGeral - 1),
          ...T.map((t) => int(s.mt[t.chave])),
        ],
      };
    }),
    legenda: `A média diária divide o volume acumulado pelo número de datas daquele dia da semana com registro (${int(r.nDatas)} datas no total), evitando a distorção causada por quantidades diferentes de cada dia no período.`,
  });

  // ----- transições -----
  const tabTrans = tabela({
    cab: ['Transição', 'Variação total', 'Δ veículos/dia', ...T.map((t) => `<span class="sw" style="background:${t.cor}"></span>${esc(t.nome)}`)],
    num: [1, 2, ...T.map((_, i) => i + 3)],
    corpo: r.transicoes.map((t) => ({
      classe: t === tMax ? 'linha-max' : '',
      celulas: [
        `<b>${DIAS[t.a]} → ${DIAS[t.b]}</b>${t === tMax ? '<span class="etiqueta">maior aumento</span>' : ''}`,
        `<b>${variacao(t.var)}</b>`,
        `${t.delta > 0 ? '+' : t.delta < 0 ? '−' : ''}${int(Math.abs(t.delta))}`,
        ...T.map((tp) => variacao(t.tipos[tp.chave].var)),
      ],
    })),
    legenda: 'Variação percentual da média diária de um dia para o seguinte, no total e dentro de cada tipo de veículo.',
  });

  // ----- contribuição no aumento do fim da semana -----
  const tabContrib = (t) =>
    tabela({
      cab: ['Tipo de veículo', `Média ${DIAS_CURTOS[t.a]}`, `Média ${DIAS_CURTOS[t.b]}`, 'Variação', 'Δ veículos/dia', 'Parcela do aumento', `Participação em ${DIAS_CURTOS[t.a]}`],
      num: [1, 2, 3, 4, 5, 6],
      corpo: T.map((tp) => {
        const x = t.tipos[tp.chave];
        return [
          `<span class="sw" style="background:${tp.cor}"></span>${esc(tp.nome)}`,
          int(r.sem[t.a].mt[tp.chave]),
          int(r.sem[t.b].mt[tp.chave]),
          variacao(x.var),
          `${x.delta >= 0 ? '+' : '−'}${int(Math.abs(x.delta))}`,
          pct(x.contrib),
          pct(x.partBase),
        ];
      }),
      rodape: ['Total', int(r.sem[t.a].media), int(r.sem[t.b].media), variacao(t.var), `${t.delta >= 0 ? '+' : '−'}${int(Math.abs(t.delta))}`, '100%', '100%'],
      legenda: 'Se o aumento fosse explicado igualmente por todas as categorias, cada tipo teria a mesma variação percentual e sua parcela do aumento seria igual à sua participação no dia de partida.',
    });

  // ----- respostas -----
  const respostas = [];
  respostas.push(`<b>Maior volume médio diário:</b> ${nome(maior)}, com ${int(r.sem[maior].media)} veículos/dia (${variacao(r.sem[maior].media / r.mediaGeral - 1)} em relação à média de todos os dias).`);
  respostas.push(`<b>Menor volume médio diário:</b> ${nome(menor)}, com ${int(r.sem[menor].media)} veículos/dia (${variacao(r.sem[menor].media / r.mediaGeral - 1)}).`);
  respostas.push(
    `<b>Maior aumento percentual entre dias consecutivos:</b> ${nome(tMax.a)} → ${nome(tMax.b)}, ${variacao(tMax.var)} (${int(tMax.delta)} veículos/dia a mais).${
      tFim && tFim !== tMax && tFim.var > 0 ? ` O segundo destaque é ${nome(tFim.a)} → ${nome(tFim.b)} (${variacao(tFim.var)}), que leva ao dia de maior média.` : ''
    }`,
  );

  const difs = T.filter((t) => r.uteis.vol[t.chave] + r.fds.vol[t.chave] > 0).map((t) => ({ t, d: r.fds.comp[t.chave] - r.uteis.comp[t.chave], rv: r.fds.mt[t.chave] / r.uteis.mt[t.chave] - 1 })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const disUF = dissim(r.uteis.comp, r.fds.comp, chT);
  respostas.push(
    `<b>Perfil de dias úteis × fim de semana:</b> ${disUF >= 0.03 ? 'muda' : 'muda pouco'} (dissimilaridade de ${pct(disUF)}). ${difs
      .map((x) => `${esc(x.t.nome)}: ${pct(r.uteis.comp[x.t.chave])} → ${pct(r.fds.comp[x.t.chave])} (${x.d >= 0 ? '+' : '−'}${pp(Math.abs(x.d))}; média diária ${variacao(x.rv)})`)
      .join('; ')}.`,
  );

  if (tFim && tFim.var > 0) {
    const vs = T.map((t) => ({ t, ...tFim.tipos[t.chave] })).filter((x) => Number.isFinite(x.var));
    const amp = Math.max(...vs.map((x) => x.var)) - Math.min(...vs.map((x) => x.var));
    const lider = argmax(vs, (x) => x.contrib);
    const igual = amp < 0.02;
    respostas.push(
      `<b>O aumento do fim da semana (${nome(tFim.a)} → ${nome(tFim.b)}) é explicado igualmente por todas as categorias?</b> ${
        igual
          ? `Sim: as variações por tipo ficam dentro de ${pp(amp)} entre si.`
          : `Não. ${lista(vs.sort((a, b) => b.var - a.var).map((x) => `${esc(x.t.nome)} ${variacao(x.var)}`))}.
             ${esc(lider.t.nome)} responde por ${pct(lider.contrib)} do aumento, embora represente ${pct(lider.partBase)} do volume de ${DIAS[tFim.a].toLowerCase()}.`
      }`,
    );
  }

  // ----- robustez: mesmo resultado em cada equipamento? -----
  let robustez = '';
  if (!filtro) {
    const porEq = ds.equipamentos.map((e) => {
      const re = calcular(linhas.filter((l) => l.eq === e.id), T);
      const ok = ORDEM_SEMANA.filter((d) => re.sem[d].n > 0);
      if (ok.length < 7) return null;
      return { e, maior: argmax(ok, (d) => re.sem[d].media), menor: argmin(ok, (d) => re.sem[d].media), tMax: argmax(re.transicoes, (t) => t.var) };
    }).filter(Boolean);
    const conta = (f) => porEq.filter(f).length;
    robustez = `<li><b>Consistência entre equipamentos.</b> Calculando separadamente para cada um dos ${porEq.length} equipamentos:
      ${nome(maior).toLowerCase()} é o dia de maior média em ${conta((x) => x.maior === maior)}, ${nome(menor).toLowerCase()} o de menor em ${conta((x) => x.menor === menor)}
      e ${DIAS_CURTOS[tMax.a]} → ${DIAS_CURTOS[tMax.b]} o maior aumento em ${conta((x) => x.tMax.a === tMax.a && x.tMax.b === tMax.b)}.
      ${porEq.filter((x) => x.maior !== maior || x.menor !== menor).map((x) => `${esc(x.e.id)}: maior em ${DIAS[x.maior].toLowerCase()}, menor em ${DIAS[x.menor].toLowerCase()}.`).join(' ')}
      Como “Todos” soma os equipamentos ativos em cada data, datas em que algum equipamento não registrou entram com volume menor — use o seletor acima para conferir cada ponto.</li>`;
  }

  return `
    <section class="bloco resposta"><h3>Respostas</h3><ul class="achados">${respostas.map((x) => `<li>${x}</li>`).join('')}${robustez}</ul></section>

    <div class="duas-colunas">
      <section class="bloco">
        ${barrasH({
          titulo: `Volume médio diário por dia da semana — ${esc(rotuloFiltro)}`,
          linhas: ORDEM_SEMANA.map((d) => ({
            rotulo: DIAS[d],
            valor: r.sem[d].media,
            texto: int(r.sem[d].media),
            destaque: d === maior || d === menor,
            tip: `<b>${DIAS[d]}</b><br>${int(r.sem[d].media)} veículos/dia<br>${int(r.sem[d].n)} datas · ${int(r.sem[d].soma)} acumulados`,
          })),
        })}
      </section>
      <section class="bloco">
        ${grafLinhas({
          titulo: 'Índice da média diária por tipo (média semanal do tipo = 100)',
          x: ORDEM_SEMANA.map((d) => DIAS_CURTOS[d]),
          rotuloTip: (i) => DIAS[ORDEM_SEMANA[i]],
          series: T.filter((t) => r.mediaGeralT[t.chave] > 0).map((t) => ({ nome: t.nome, cor: t.cor, valores: ORDEM_SEMANA.map((d) => (r.sem[d].mt[t.chave] / r.mediaGeralT[t.chave]) * 100) })),
          fmt: (v) => dec(v, 1),
          fmtEixo: (v) => int(v),
          ref: 100,
          altura: 300,
        })}
        <p class="nota">Cada linha é comparada com a sua própria média: mostra quanto cada tipo sobe ou desce ao longo da semana, independentemente do seu volume.</p>
      </section>
    </div>

    <section class="bloco"><h3>Média diária por dia da semana</h3>${tabDias}</section>

    <section class="bloco"><h3>Variação entre dias consecutivos</h3>${tabTrans}</section>


      <section class="bloco">
        <h3>Composição: dias úteis × fim de semana</h3>
        ${barras100({
          series: T,
          linhas: [
            { rotulo: 'Dias úteis', sub: `${int(r.uteis.n)} datas · ${int(r.uteis.media)}/dia`, valores: r.uteis.vol },
            { rotulo: 'Fim de semana', sub: `${int(r.fds.n)} datas · ${int(r.fds.media)}/dia`, valores: r.fds.vol },
          ],
        })}
        ${tabela({
          cab: ['Tipo de veículo', 'Dias úteis (média/dia)', 'Fim de semana (média/dia)', 'Part. úteis', 'Part. fim de semana', 'Diferença'],
          num: [1, 2, 3, 4, 5],
          corpo: T.map((t) => [
            `<span class="sw" style="background:${t.cor}"></span>${esc(t.nome)}`,
            int(r.uteis.mt[t.chave]),
            int(r.fds.mt[t.chave]),
            pct(r.uteis.comp[t.chave]),
            pct(r.fds.comp[t.chave]),
            `${r.fds.comp[t.chave] - r.uteis.comp[t.chave] >= 0 ? '+' : '−'}${pp(Math.abs(r.fds.comp[t.chave] - r.uteis.comp[t.chave]))}`,
          ]),
          legenda: 'Dias úteis = segunda a sexta; fim de semana = sábado e domingo.',
        })}
      </section>
    <section class="bloco">
        <h3>Quem explica o aumento até ${nome(maior).toLowerCase()} (média diária)</h3>
        ${tFim ? tabContrib(tFim) : ''}
      </section>
    ${tMax !== tFim ? `<section class="bloco"><h3>Quem explica o maior aumento (${trans(tMax)})</h3>${tabContrib(tMax)}</section>` : ''}
  `;
}

export function renderTemporal(el, ds) {
  const opcoes = [['', 'Todos os equipamentos'], ...ds.equipamentos.map((e) => [e.id, `${e.id} — km ${int(e.km)}, ${e.sentidos.join('/')}`])];
  el.innerHTML = `
    <header class="aba-cab">
      <h2>Variação temporal do tráfego</h2>
      <p class="pergunta">Como o volume e o perfil dos veículos variam ao longo da semana?</p>
    </header>
    <div class="filtros">
      <label>Equipamento
        <select id="filtro-eq">${opcoes.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>
      </label>
    </div>
    <div id="temporal-conteudo"></div>
  `;
  const alvo = el.querySelector('#temporal-conteudo');
  const sel = el.querySelector('#filtro-eq');
  const desenhar = () => {
    const f = sel.value;
    const linhas = f ? ds.linhas.filter((l) => l.eq === f) : ds.linhas;
    alvo.innerHTML = conteudo(ds, linhas, sel.options[sel.selectedIndex].text, f);
    ativarGraficos(alvo);
  };
  sel.addEventListener('change', desenhar);
  desenhar();
}
