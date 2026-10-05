import { esc, int, pct, pctA, dec, lista, somaPor, cruzar, composicao, dissim, argmax } from '../util.js';
import { tabela, barras100, celPct } from '../graficos.js';

const N_PEQUENO = 100;

/** Categoria em que a distribuição acumulada atinge a fração `q`. */
function categoriaQuantil(comp, vels, q) {
  let acc = 0;
  for (const v of vels) {
    acc += comp[v.chave];
    if (acc >= q - 1e-12) return v;
  }
  return vels[vels.length - 1];
}

export function renderDistribuicaoVelocidade(el, ds) {
  const V = ds.velocidades;
  const chV = V.map((v) => v.chave);
  const mx = cruzar(ds.linhas, (l) => l.tipo, (l) => l.vel);
  const porVel = somaPor(ds.linhas, (l) => l.vel);
  const compG = composicao(porVel, chV);
  const ate50 = V.filter((v) => v.hi <= 50);
  const acima80 = V.filter((v) => v.lo >= 80);
  const acima100 = V.filter((v) => v.acima100);
  const soma = (comp, grupo) => grupo.reduce((s, v) => s + comp[v.chave], 0);

  const perfil = (rotulo, comp, totalTipo, n) => ({
    rotulo,
    comp,
    total: totalTipo,
    n,
    modal: argmax(V, (v) => comp[v.chave]),
    mediana: categoriaQuantil(comp, V, 0.5),
    p85: categoriaQuantil(comp, V, 0.85),
    ate50: soma(comp, ate50),
    acima80: soma(comp, acima80),
    acima100: soma(comp, acima100),
    nAcima100: acima100.reduce((s, v) => s + (n[v.chave] || 0), 0),
    dis: dissim(comp, compG, chV),
  });

  const tipos = ds.tipos.map((t) => {
    const r = mx.get(t.chave) || { total: 0, c: new Map() };
    const n = Object.fromEntries(chV.map((k) => [k, r.c.get(k) || 0]));
    return { t, ...perfil(t.nome, composicao(r.c, chV), r.total, n) };
  });
  const nG = Object.fromEntries(chV.map((k) => [k, porVel.get(k) || 0]));
  const geral = perfil('Conjunto', compG, ds.total, nG);
  const comVol = tipos.filter((x) => x.total > 0);

  const tab = tabela({
    cab: ['Tipo de veículo', ...V.map((v) => `<span class="sw" style="background:${v.cor}"></span>${esc(v.rotulo)}`), 'Veículos'],
    num: [...V.map((_, i) => i + 1), V.length + 1],
    corpo: tipos.map((x) => [
      `<span class="sw" style="background:${x.t.cor}"></span><b>${esc(x.t.nome)}</b>`,
      ...V.map((v) => celPct(x.comp[v.chave], x.n[v.chave], x.n[v.chave] > 0 && x.n[v.chave] < N_PEQUENO)),
      int(x.total),
    ]),
    rodape: ['<b>Conjunto</b>', ...V.map((v) => pctA(compG[v.chave])), int(ds.total)],
    legenda: `Percentuais calculados dentro de cada tipo de veículo (a linha soma 100%). <sup>†</sup> célula com menos de ${N_PEQUENO} veículos.`,
  });

  const resumo = tabela({
    cab: ['Tipo de veículo', 'Categoria mais frequente', 'Categoria mediana', 'Categoria do 85º percentil', `Até 50 km/h`, 'Acima de 80 km/h', 'Acima de 100 km/h', 'Veíc. > 100 km/h', 'Por 100 mil veíc.', 'Dissimilaridade vs. conjunto'],
    num: [4, 5, 6, 7, 8, 9],
    corpo: [...tipos, { t: null, ...geral }].map((x) => [
      x.t ? `<span class="sw" style="background:${x.t.cor}"></span>${esc(x.t.nome)}` : '<b>Conjunto</b>',
      x.total ? `${esc(x.modal.rotulo)} <small>(${pct(x.comp[x.modal.chave])})</small>` : '—',
      x.total ? esc(x.mediana.rotulo) : '—',
      x.total ? esc(x.p85.rotulo) : '—',
      pct(x.ate50),
      pctA(x.acima80),
      pctA(x.acima100),
      int(x.nAcima100),
      x.total ? dec((x.nAcima100 / x.total) * 1e5, 1) : '—',
      x.t ? pct(x.dis) : '—',
    ]),
    legenda: 'Como os dados são agregados em categorias, mediana e 85º percentil indicam a categoria em que a distribuição acumulada atinge 50% e 85% — não um valor exato de velocidade.',
  });

  // ----- interpretação -----
  const ach = [];
  const modalG = geral.modal;
  const mesmoModal = comVol.filter((x) => x.modal === modalG);
  const outroModal = comVol.filter((x) => x.modal !== modalG);
  ach.push(
    `<b>Categoria mais frequente.</b> ${
      outroModal.length
        ? `${lista(mesmoModal.map((x) => esc(x.t.nome)))} ${mesmoModal.length > 1 ? 'concentram' : 'concentra'} a maior parte do volume em ${esc(modalG.rotulo)} (${lista(mesmoModal.map((x) => pct(x.comp[modalG.chave])))}, respectivamente). ${outroModal
            .map((x) => `${esc(x.t.nome)} é exceção: ${pct(x.comp[x.modal.chave])} dos seus registros estão em ${esc(x.modal.rotulo)}.`)
            .join(' ')}`
        : `Todos os tipos concentram a maior parte do volume em ${esc(modalG.rotulo)}.`
    }`,
  );

  const porAte50 = [...comVol].sort((a, b) => b.ate50 - a.ate50);
  ach.push(
    `<b>Velocidades baixas (até 50 km/h).</b> A participação varia de ${pct(porAte50[porAte50.length - 1].ate50)} (${esc(porAte50[porAte50.length - 1].t.nome)}) a ${pct(porAte50[0].ate50)} (${esc(porAte50[0].t.nome)}). Ordem: ${porAte50
      .map((x) => `${esc(x.t.nome)} ${pct(x.ate50)}`)
      .join(' > ')}.`,
  );

  const porAcima = [...comVol].sort((a, b) => b.acima100 - a.acima100);
  ach.push(
    `<b>Acima de 100 km/h.</b> Em todos os tipos a fração é muito pequena — no conjunto, ${pctA(geral.acima100)} (${int(geral.nAcima100)} veículos).
    Proporcionalmente, a ordem é ${porAcima.map((x) => `${esc(x.t.nome)} (${dec((x.nAcima100 / x.total) * 1e5, 1)} por 100 mil; ${int(x.nAcima100)} veículos)`).join(' > ')}.
    ${porAcima.some((x) => x.nAcima100 > 0 && x.nAcima100 < N_PEQUENO) ? 'Taxas apoiadas em menos de 100 veículos devem ser lidas com cautela.' : ''}`,
  );

  const distante = argmax(comVol, (x) => x.dis);
  const proximo = argmax(comVol, (x) => -x.dis);
  ach.push(
    `<b>Diferença entre os perfis.</b> A distribuição de ${esc(proximo.t.nome)} é a mais próxima da do conjunto (dissimilaridade ${pct(proximo.dis)}), em parte porque esse tipo responde por ${pct(proximo.total / ds.total)} do volume.
    ${esc(distante.t.nome)} é a mais distante (${pct(distante.dis)}).`,
  );

  // Exemplo: a célula com maior participação dentro de uma categoria de volume pequeno.
  const candidatos = (acima100.length ? acima100 : V).flatMap((v) =>
    comVol.filter((x) => x.n[v.chave] > 0 && porVel.get(v.chave) >= 100).map((x) => ({ x, v, naCat: x.n[v.chave] / porVel.get(v.chave) })),
  );
  const ex = argmax(candidatos, (c) => c.naCat);
  if (ex) {
    ach.push(
      `<b>Leitura em relação à aba anterior.</b> Na aba “Tipo de veículo × velocidade”, o denominador é a categoria de velocidade; aqui, é o tipo de veículo.
      Os dois percentuais respondem a perguntas diferentes: ${esc(ex.x.t.nome)} representa ${pct(ex.naCat)} dos veículos de ${esc(ex.v.rotulo)}, mas essa categoria
      reúne apenas ${pctA(ex.x.comp[ex.v.chave])} dos veículos do tipo ${esc(ex.x.t.nome)} (${int(ex.x.n[ex.v.chave])} de ${int(ex.x.total)}).`,
    );
  }

  el.innerHTML = `
    <header class="aba-cab">
      <h2>Distribuição de velocidade por tipo de veículo</h2>
      <p class="pergunta">Como o volume de cada tipo de veículo se distribui entre as categorias de velocidade?</p>
    </header>

    <section class="bloco">
      ${barras100({
        titulo: 'Distribuição das categorias de velocidade dentro de cada tipo (100% por linha)',
        series: V,
        linhas: [...tipos, { t: null, ...geral }].filter((x) => x.total).map((x) => ({ rotulo: x.rotulo, sub: `${int(x.total)} veíc.`, valores: x.n })),
      })}
      <p class="nota">Segmentos menores que 0,2% não aparecem na barra; os valores completos estão na tabela.</p>
    </section>

    <section class="bloco">
      <h3>Distribuição percentual por tipo de veículo</h3>
      ${tab}
    </section>

    <section class="bloco">
      <h3>Indicadores por tipo de veículo</h3>
      ${resumo}
    </section>

    <section class="bloco">
      <h3>Interpretação</h3>
      <ul class="achados">${ach.map((a) => `<li>${a}</li>`).join('')}</ul>
    </section>
  `;
}
