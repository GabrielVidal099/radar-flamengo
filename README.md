# Radar do Flamengo

App instalável (PWA) com as notícias do Flamengo reunidas em um radar: no centro as mais recentes, na borda as de 7 dias atrás.

Projeto de torcedor, sem vínculo com o Clube de Regatas do Flamengo. As manchetes pertencem aos veículos citados e cada uma leva à matéria original.

## Como funciona

O app tem cinco telas: Início (próximo jogo, últimos resultados, tabela, artilheiros e notícias), Jogos (próximos e resultados, com página de cada partida: resumo, escalações, estatísticas e confronto), Tabela do Brasileirão, Elenco (com ficha de cada jogador) e Radar de notícias em 3D.

- `index.html` é o app. Ele lê `noticias.json` e desenha o radar e o feed.
- `scripts/dados.mjs` busca jogos, tabela, elenco e detalhes das partidas em endpoints públicos da ESPN e grava em `dados/`. Os escudos dos times vêm da CDN da ESPN.
- `scripts/atualizar.mjs` busca as manchetes no Google Notícias, descarta repetidas e redes sociais, classifica por editoria e regrava `noticias.json`. Notícias com mais de 10 dias saem.
- `.github/workflows/atualizar.yml` roda esse script a cada 30 minutos no GitHub Actions.
- `sw.js` e `manifest.webmanifest` deixam o app instalável e abrindo sem internet com as últimas notícias salvas.

## Rodar no computador

```bash
node scripts/atualizar.mjs
```

```bash
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Publicar

1. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
2. Em **Settings > Actions > General > Workflow permissions**, marque **Read and write permissions**.
3. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Monograma do clube

O selo do cabeçalho usa o monograma CRF em branco (`icons/monograma.png`), o mesmo arquivo que o site oficial do clube serve. Ele pertence ao Clube de Regatas do Flamengo; este é um projeto de torcedor, sem vínculo com o clube. Para trocar por outro arquivo, substitua `icons/monograma.png` por um PNG com fundo transparente.

## Radar 3D

`stadium3d.js` monta o Maracanã em 3D com three.js (copiado em `vendor/`, licença MIT). As medidas vêm do estádio real (campo de 105 x 68 m, casca externa de cerca de 317 x 279 m, duas arquibancadas e cobertura em anel), mas o modelo é construído em código, não é um escaneamento. Sem WebGL, o app mostra o mapa 2D.
