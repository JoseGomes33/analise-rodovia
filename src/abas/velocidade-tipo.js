import { esc, int, pct, pctA, pp, lista, somaPor, cruzar, composicao, dissim, argmax } from '../util.js';
import { tabela, barras100, barrasH, celPct } from '../graficos.js';

// Categoria com menos de 1% do volume total não é "expressiva"; com menos de 0,1% tem volume muito pequeno.
const LIMIAR_EXPRESSIVA = 0.01;
const LIMIAR_PEQUENA = 0.001;
// Célula com menos de 100 veículos é sinalizada na tabela.
const N_PEQUENO = 100;
// Dissimilaridade acima de 15% em relação ao conjunto indica composição claramente diferente.
const DIS_DIFERENTE = 0.15;

export function renderVelocidadeTipo(el, ds) {
  const T = ds.tipos;
  const chT = T.map((t) => t.chave);
  const total = ds.total;
  const mx = cruzar(ds.linhas, (l) => l.vel, (l) => l.tipo);
  const compG = composicao(somaPor(ds.linhas, (l) => l.tipo), chT);

  const cats = ds.velocidades.map((v) => {
    const r = mx.get(v.chave) || { total: 0, c: new Map() };
    const comp = composicao(r.c, chT);
    return {
      v,
      total: r.total,
      n: Object.fromEntries(chT.map((k) => [k, r.c.get(k) || 0])),
      comp,
      part: r.total / total,
      dis: dissim(comp, compG, chT),
      maior: argmax(T, (t) => comp[t.chave]),
    };
  });
  const comVolume = cats.filter((c) => c.total > 0);
  const expressivas = comVolume.filter((c) => c.part >= LIMIAR_EXPRESSIVA);
  const pequenas = comVolume.filter((c) => c.part < LIMIAR_PEQUENA);

  // ----- tabela -----
  const tab = tabela({
    cab: ['Velocidade', ...T.map((t) => `<span class="sw" style="background:${t.cor}"></span>${esc(t.nome)}`), 'Soma', 'Veículos na categoria', '% do volume total', 'Dissimilaridade vs. conjunto'],
    num: [...T.map((_, i) => i + 1), T.length + 1, T.length + 2, T.length + 3, T.length + 4],
    corpo: cats.map((c) => ({
      classe: c.part < LIMIAR_PEQUENA ? 'linha-pequena' : '',
      celulas: [
        `<b>${esc(c.v.rotulo)}</b>${c.part < LIMIAR_PEQUENA && c.total ? '<span class="etiqueta">volume muito pequeno</span>' : ''}`,
        ...T.map((t) => celPct(c.comp[t.chave], c.n[t.chave], c.n[t.chave] > 0 && c.n[t.chave] < N_PEQUENO)),
        c.total ? pct(chT.reduce((s, k) => s + c.comp[k], 0)) : '—',
        int(c.total),
        pctA(c.part),
        c.total ? pct(c.dis) : '—',
      ],
    })),
    rodape: ['<b>Conjunto</b>', ...T.map((t) => pct(compG[t.chave])), '100,0%', int(total), '100%', '—'],
    legenda: `Percentuais calculados dentro de cada categoria de velocidade (a linha soma 100%); o número abaixo de cada percentual é o volume absoluto.
      <sup>†</sup> célula com menos de ${N_PEQUENO} veículos. Linhas esmaecidas: categoria com menos de ${pct(LIMIAR_PEQUENA)} do volume total.
      Dissimilaridade = metade da soma das diferenças absolutas entre a composição da categoria e a do conjunto (0% = idêntica).`,
  });

  // ----- interpretação -----
  const ach = [];
  const compTxt = (comp) => lista(T.map((t) => `${esc(t.nome)} ${pct(comp[t.chave])}`));
  ach.push(`<b>Referência.</b> No conjunto de todas as categorias, a frota registrada é composta por ${compTxt(compG)}.`);

  const maiorG = argmax(T, (t) => compG[t.chave]);
  const excecoes = comVolume.filter((c) => c.maior !== maiorG);
  if (!excecoes.length) {
    ach.push(`<b>Tipo predominante.</b> ${esc(maiorG.nome)} é o tipo mais frequente em todas as ${comVolume.length} categorias com registro.`);
  } else {
    ach.push(
      `<b>Tipo predominante.</b> ${esc(maiorG.nome)} é o tipo mais frequente em ${comVolume.length - excecoes.length} das ${comVolume.length} categorias. ${excecoes
        .map((c) => `Em <b>${esc(c.v.rotulo)}</b> predomina ${esc(c.maior.nome)} (${pct(c.comp[c.maior.chave])} da categoria, contra ${pct(compG[c.maior.chave])} no conjunto), com ${int(c.n[c.maior.chave])} veículos.`)
        .join(' ')}`,
    );
  }

  const destoantes = expressivas.filter((c) => c.dis > DIS_DIFERENTE);
  const estaveis = expressivas.filter((c) => c.dis <= DIS_DIFERENTE);
  const faixasTipo = (grupo) =>
    lista(
      T.map((t) => {
        const vs = grupo.map((c) => c.comp[t.chave]);
        const lo = Math.min(...vs);
        const hi = Math.max(...vs);
        return `${esc(t.nome)} de ${pct(lo)} a ${pct(hi)} (${pp(hi - lo)})`;
      }),
    );
  if (estaveis.length >= 2) {
    ach.push(
      `<b>Categorias de volume expressivo.</b> ${lista(expressivas.map((c) => esc(c.v.rotulo)))} concentram ${pct(expressivas.reduce((s, c) => s + c.part, 0))} do volume.
      ${destoantes.length ? `Excluindo ${lista(destoantes.map((c) => esc(c.v.rotulo)))}, as categorias` : 'Nelas,'} ${lista(estaveis.map((c) => esc(c.v.rotulo)))} têm composição próxima entre si: ${faixasTipo(estaveis)}.`,
    );
  } else if (expressivas.length) {
    ach.push(`<b>Categorias de volume expressivo.</b> ${lista(expressivas.map((c) => `${esc(c.v.rotulo)} (dissimilaridade ${pct(c.dis)})`))}. Nelas: ${faixasTipo(expressivas)}.`);
  }
  for (const c of destoantes) {
    const difs = T.map((t) => ({ t, d: c.comp[t.chave] - compG[t.chave] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    ach.push(
      `<b>${esc(c.v.rotulo)} destoa do padrão.</b> Com ${int(c.total)} veículos (${pct(c.part)} do total), é uma categoria de volume expressivo e sua composição difere ${pct(c.dis)} da do conjunto. A maior diferença está em ${esc(difs[0].t.nome)} (${pct(c.comp[difs[0].t.chave])} contra ${pct(compG[difs[0].t.chave])}).
      O arquivo não informa por que esses veículos não foram classificados; o dado só permite afirmar que essa categoria concentra registros desse tipo.`,
    );
  }

  // Tendência ao longo das categorias com pelo menos 0,1% do volume.
  const ordenadas = comVolume.filter((c) => c.part >= LIMIAR_PEQUENA);
  if (ordenadas.length >= 3) {
    const monotonas = T.filter((t) => {
      const vs = ordenadas.map((c) => c.comp[t.chave]);
      const d = vs.slice(1).map((v, i) => v - vs[i]);
      return d.every((x) => x >= 0) || d.every((x) => x <= 0);
    });
    const trajetoria = (t) => ordenadas.map((c) => pct(c.comp[t.chave])).join(' → ');
    ach.push(
      `<b>Com o aumento da velocidade.</b> Percorrendo as categorias de ${esc(ordenadas[0].v.rotulo)} a ${esc(ordenadas[ordenadas.length - 1].v.rotulo)},
      ${monotonas.length ? `${lista(monotonas.map((t) => esc(t.nome)))} ${monotonas.length > 1 ? 'variam' : 'varia'} sempre no mesmo sentido` : 'nenhum tipo cresce ou diminui de forma contínua'}:
      ${T.map((t) => `${esc(t.nome)} ${trajetoria(t)}`).join('; ')}.`,
    );
  }

  if (pequenas.length) {
    const nPeq = pequenas.reduce((s, c) => s + c.total, 0);
    const exemplos = pequenas.map((c) => {
      const dom = c.maior;
      const raro = T.filter((t) => c.n[t.chave] > 0 && c.n[t.chave] <= 10).sort((a, b) => c.n[a.chave] - c.n[b.chave])[0];
      return `em <b>${esc(c.v.rotulo)}</b>, ${esc(dom.nome)} = ${pct(c.comp[dom.chave])} corresponde a ${int(c.n[dom.chave])} veículos${
        raro ? `, e ${int(c.n[raro.chave])} ${c.n[raro.chave] === 1 ? 'único veículo' : 'veículos'} ${esc(raro.nome)} já ${c.n[raro.chave] === 1 ? 'equivale' : 'equivalem'} a ${pctA(c.comp[raro.chave])}` : ''
      } (cada veículo vale ${pp(1 / c.total, 2)})`;
    });
    ach.push(
      `<b>Percentuais altos sobre volumes muito pequenos.</b> ${lista(pequenas.map((c) => esc(c.v.rotulo)))} somam apenas ${int(nPeq)} veículos (${pctA(nPeq / total)} do total).
      Nessas categorias, poucos veículos movem muito o percentual: ${exemplos.join('; ')}.
      Esses percentuais descrevem corretamente o que foi registrado, mas não têm a mesma estabilidade dos percentuais das categorias com milhões de veículos — pequenas variações absolutas mudam a composição em vários pontos percentuais.`,
    );
  }

  const estavel = !destoantes.length && expressivas.every((c) => c.dis <= DIS_DIFERENTE);
  const resposta = estavel
    ? `Sim, nas categorias com volume relevante a composição é semelhante: a dissimilaridade em relação ao conjunto fica abaixo de ${pct(DIS_DIFERENTE, 0)} em todas elas.`
    : `Não inteiramente. A composição é parecida entre ${lista(estaveis.map((c) => esc(c.v.rotulo)))}, mas ${lista(destoantes.map((c) => esc(c.v.rotulo)))} ${destoantes.length > 1 ? 'têm' : 'tem'} um perfil muito diferente${
        pequenas.length ? `, e em ${lista(pequenas.map((c) => esc(c.v.rotulo)))} os percentuais se apoiam em poucos veículos` : ''
      }. Portanto, a composição da frota não permanece estável em toda a escala de velocidade.`;

  el.innerHTML = `
    <header class="aba-cab">
      <h2>Tipo de veículo × velocidade</h2>
      <p class="pergunta">A composição dos tipos de veículos é semelhante entre as diferentes categorias de velocidade?</p>
    </header>

    <section class="bloco resposta"><h3>Resposta</h3><p>${resposta}</p></section>

    <section class="bloco">
      <h3>Participação de cada tipo de veículo por categoria de velocidade</h3>
      ${tab}
    </section>

    <div class="duas-colunas">
      <section class="bloco">
        ${barras100({
          titulo: 'Composição de cada categoria (100% por linha)',
          series: T,
          linhas: cats.filter((c) => c.total).map((c) => ({ rotulo: c.v.rotulo, sub: `${int(c.total)} veíc.`, valores: c.n })),
        })}
      </section>
      <section class="bloco">
        ${barrasH({
          titulo: 'Volume absoluto de cada categoria',
          linhas: cats.map((c) => ({ rotulo: c.v.rotulo, valor: c.total, texto: int(c.total), cor: c.v.cor })),
        })}
        <p class="nota">As duas figuras devem ser lidas juntas: barras de mesmo comprimento à esquerda representam de ${int(Math.min(...comVolume.map((c) => c.total)))} a ${int(Math.max(...comVolume.map((c) => c.total)))} veículos.</p>
      </section>
    </div>

    <section class="bloco">
      <h3>Interpretação</h3>
      <ul class="achados">${ach.map((a) => `<li>${a}</li>`).join('')}</ul>
    </section>
  `;
}
