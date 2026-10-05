import { carregarDeUrl, lerArquivo, prepararDados } from './dados.js';
import { iniciarTooltip, ativarGraficos } from './graficos.js';
import { esc, int, dataBR } from './util.js';
import { renderCaracterizacao } from './abas/caracterizacao.js';
import { renderVelocidadeTipo } from './abas/velocidade-tipo.js';
import { renderDistribuicaoVelocidade } from './abas/distribuicao-velocidade.js';
import { renderTemporal } from './abas/temporal.js';
import { renderEspacial } from './abas/espacial.js';

const ARQUIVO_PADRAO = 'volume-radar-trans.csv';

const ABAS = [
  { id: 'caracterizacao', titulo: 'Caracterização do conjunto de dados', render: renderCaracterizacao },
  { id: 'tipo-velocidade', titulo: 'Tipo de veículo × velocidade', render: renderVelocidadeTipo },
  { id: 'distribuicao', titulo: 'Distribuição de velocidade por tipo de veículo', render: renderDistribuicaoVelocidade },
  { id: 'temporal', titulo: 'Variação temporal do tráfego', render: renderTemporal },
  { id: 'espacial', titulo: 'Análise espacial e operacional', render: renderEspacial },
];

const nav = document.getElementById('abas');
const main = document.getElementById('conteudo');
const resumo = document.getElementById('resumo');
let dados = null;

function abaInicial() {
  const id = location.hash.slice(1);
  return ABAS.some((a) => a.id === id) ? id : ABAS[0].id;
}

function montarAbas() {
  nav.innerHTML = ABAS.map(
    (a, i) => `<button type="button" role="tab" id="tab-${a.id}" aria-controls="painel-${a.id}" data-aba="${a.id}">
      <span class="aba-num">${i + 1}</span>${esc(a.titulo)}</button>`,
  ).join('');
  main.innerHTML = ABAS.map((a) => `<section class="painel" role="tabpanel" id="painel-${a.id}" aria-labelledby="tab-${a.id}" hidden></section>`).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (b) ativar(b.dataset.aba, true);
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const atual = ABAS.findIndex((a) => a.id === nav.querySelector('[aria-selected="true"]')?.dataset.aba);
    const prox = ABAS[(atual + (e.key === 'ArrowRight' ? 1 : -1) + ABAS.length) % ABAS.length];
    ativar(prox.id, true);
    document.getElementById(`tab-${prox.id}`).focus();
  });
  window.addEventListener('hashchange', () => ativar(abaInicial(), false));
}

function ativar(id, atualizarHash) {
  for (const a of ABAS) {
    const ativo = a.id === id;
    const botao = document.getElementById(`tab-${a.id}`);
    botao.setAttribute('aria-selected', String(ativo));
    botao.tabIndex = ativo ? 0 : -1;
    const painel = document.getElementById(`painel-${a.id}`);
    painel.hidden = !ativo;
    if (ativo && dados && painel.dataset.versao !== String(dados.versao)) {
      try {
        a.render(painel, dados);
      } catch (err) {
        console.error(err);
        painel.innerHTML = `<p class="aviso">Não foi possível montar esta análise: ${esc(err.message)}</p>`;
      }
      painel.dataset.versao = String(dados.versao);
    }
    if (ativo) {
      ativarGraficos(painel);
      botao.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  if (atualizarHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
}

let versao = 0;
function usarDados(texto, nome) {
  const ds = prepararDados(texto, nome);
  ds.versao = ++versao;
  dados = ds;
  resumo.textContent = `${ds.equipamentos.length} equipamentos · ${dataBR(ds.dias[0])} a ${dataBR(ds.dias[ds.dias.length - 1])} · ${int(ds.total)} veículos · arquivo ${nome}`;
  if (!nav.children.length) montarAbas();
  ativar(document.querySelector('[aria-selected="true"][data-aba]')?.dataset.aba || abaInicial(), false);
}

function telaSelecao(motivo) {
  const local = location.protocol === 'file:';
  main.innerHTML = `
    <div class="estado">
      <div class="selecao" id="soltar">
        <h2>Selecione o arquivo de dados</h2>
        <p>${local
          ? 'A página foi aberta diretamente do disco (<code>file://</code>), e o navegador não permite que ela leia o CSV sozinha.'
          : `Não foi possível carregar <code>${ARQUIVO_PADRAO}</code> (${esc(motivo)}).`}
          Escolha o arquivo <code>${ARQUIVO_PADRAO}</code> (ou outro CSV no mesmo formato da ANTT) — ele é lido apenas no seu navegador.</p>
        <label class="botao-arquivo grande"><input type="file" accept=".csv,text/csv" id="arquivo-inicial" />Escolher arquivo CSV</label>
        <p class="nota">Você também pode arrastar o arquivo para esta área.</p>
      </div>
    </div>`;
  resumo.textContent = 'Aguardando arquivo de dados';
  const zona = document.getElementById('soltar');
  document.getElementById('arquivo-inicial').addEventListener('change', (e) => abrirArquivo(e.target.files[0]));
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('arrastando');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('arrastando');
    abrirArquivo(e.dataTransfer.files[0]);
  });
}

async function abrirArquivo(arquivo) {
  if (!arquivo) return;
  resumo.textContent = `Lendo ${arquivo.name}…`;
  try {
    const texto = await lerArquivo(arquivo);
    if (!nav.children.length) main.innerHTML = '';
    usarDados(texto, arquivo.name);
  } catch (err) {
    console.error(err);
    alert(`Não foi possível ler o arquivo: ${err.message}`);
    if (!dados) telaSelecao(err.message);
    else resumo.textContent = `Erro ao ler ${arquivo.name}; mantendo os dados anteriores.`;
  }
}

async function iniciar() {
  iniciarTooltip();
  document.getElementById('arquivo').addEventListener('change', (e) => abrirArquivo(e.target.files[0]));
  try {
    const texto = await carregarDeUrl(`./${ARQUIVO_PADRAO}`);
    main.innerHTML = '';
    usarDados(texto, ARQUIVO_PADRAO);
  } catch (err) {
    console.warn(err);
    telaSelecao(err.message);
  }
}

iniciar();
