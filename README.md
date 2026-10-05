# Análise dos radares de velocidade — BR-153 (Transbrasiliana)

Sistema web que analisa o tráfego registrado pelos radares de controle de velocidade da BR-153, a partir do arquivo
`volume-radar-trans.csv` do Sistema de Informação de Rodovias da ANTT.

Todos os cálculos são feitos no navegador a partir do CSV: tabelas, gráficos e textos de interpretação são gerados
dos dados, então funcionam também com outro arquivo no mesmo formato (botão **Carregar outro CSV**).

## Abas

| Aba | Conteúdo |
| --- | --- |
| 1. Caracterização do conjunto de dados | Período, equipamentos, rodovia/UF/municípios, tipos de veículo, categorias de velocidade, sentidos, faixas, volume total, cobertura temporal e observações sobre o arquivo (Tarefa 1). |
| 2. Tipo de veículo × velocidade | Participação de cada tipo dentro de cada categoria de velocidade, com interpretação da estabilidade e dos percentuais apoiados em volumes pequenos (Tarefa 2). |
| 3. Distribuição de velocidade por tipo de veículo | A leitura inversa: como o volume de cada tipo se distribui entre as categorias (categoria modal, mediana, > 100 km/h). |
| 4. Variação temporal do tráfego | Média diária por dia da semana, transições entre dias, dias úteis × fim de semana e contribuição de cada tipo no aumento; filtro por equipamento (Tarefa 4). |
| 5. Análise espacial e operacional | Comparação entre equipamentos: volume, tipos, velocidades, dissimilaridade; opção de usar só as datas comuns (Tarefa 3). Sentidos, faixas e ranking absoluto × proporcional acima de 100 km/h (Tarefa 5). |

## Executar

Requer Node.js 18+.

```bash
npm install
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # gera dist/
npm run preview   # serve dist/ localmente
```

### Vercel

O projeto já está configurado (`vercel.json`): importe o repositório na Vercel e ela usa `npm run build`, publicando `dist/`.

### Localmente, sem servidor

O build gera um único `dist/index.html` com JS e CSS embutidos, mais `dist/volume-radar-trans.csv`.

- Servido por qualquer servidor estático (`npm run preview`, `npx serve dist`, `python -m http.server`), o CSV é carregado automaticamente.
- Aberto direto do disco (duplo clique, `file://`), o navegador bloqueia a leitura automática do CSV; a página então pede para
  selecionar ou arrastar o arquivo, que é lido localmente.

## Estrutura

```
index.html                  página e abas
public/volume-radar-trans.csv
src/dados.js                leitura (UTF-8/ISO-8859-1), validação e normalização do CSV
src/util.js                 formatação pt-BR e agregações
src/graficos.js             barras, linhas e diagrama de km (HTML/SVG, sem dependências) e tooltip
src/abas/*.js               uma análise por aba
src/style.css               tema claro/escuro
```

## Observações sobre os dados

- Cada equipamento registra um único sentido e uma única faixa (LE-60: Crescente/faixa 1; LE-30, LE-62 e LE-89: Decrescente/faixa 2),
  portanto comparações entre sentidos e entre faixas também são comparações entre equipamentos.
- O LE-89 só tem registros de 01/01/2022 a 01/06/2022; há 64 dias sem registro no período (a maior lacuna vai de 18/03 a 10/05/2023).
- Os rótulos de velocidade vêm truncados no arquivo (ex.: `81 - 100 K`) e são padronizados pelo intervalo numérico.
