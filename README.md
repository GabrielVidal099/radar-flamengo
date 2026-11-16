# Radar do Flamengo

App instalável (PWA) com as notícias do Flamengo reunidas em um radar: no centro as mais recentes, na borda as de 7 dias atrás.

Projeto de torcedor, sem vínculo com o Clube de Regatas do Flamengo. As manchetes pertencem aos veículos citados e cada uma leva à matéria original.

## Como funciona

- `index.html` é o app. Ele lê `noticias.json` e desenha o radar e o feed.
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
