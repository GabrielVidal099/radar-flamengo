// Avisos no celular pelo ntfy (gratuito): escalação, bola rolando, gols, fim de jogo e notícias importantes.
// Roda a cada 5 minutos no GitHub Actions e só faz algo quando há jogo por perto ou notícia nova.
// Configuração: crie o segredo NTFY_TOPIC no repositório (um nome longo e difícil de adivinhar) e assine esse canal no app ntfy.
//   node scripts/avisos.mjs            roda normalmente
//   node scripts/avisos.mjs --teste    envia um aviso de teste
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { num, detalharResumo, estadoAoVivo } from "../espn.js";

const TIME = "819";
const ESTADO = new URL("../dados/avisos.json", import.meta.url);
const APP = process.env.APP_URL || "https://gabrielvidal099.github.io/radar-flamengo/";
const SERVIDOR = process.env.NTFY_SERVER || "https://ntfy.sh";
const TOPICO = (process.env.NTFY_TOPIC || "").trim();
const ANTES_MIN = 90, DEPOIS_H = 4;

const lerJson = async (u, padrao) => { try { return JSON.parse(await readFile(u, "utf8")); } catch { return padrao; } };

// Decide o que avisar a partir do estado salvo e do resumo atual da partida. Não faz rede nem grava nada.
export function avaliar(prev, x, jogo, nomes) {
  const est = estadoAoVivo(x), det = detalharResumo(x, jogo);
  const novo = { escalacao: false, inicio: false, gols: 0, fim: false, ...(prev || {}) };
  const msgs = [];
  if (!est) return { novo, msgs };
  const nome = (id) => nomes[id] || id;
  const casa = nome(est.casaId), fora = nome(est.foraId), placar = () => `${casa} ${est.golsCasa ?? 0} x ${est.golsFora ?? 0} ${fora}`;
  const link = APP + "#/jogo/" + jogo.id;
  const meu = det.times.find((t) => t.id === TIME);

  if (!novo.escalacao && meu && meu.jogadores.filter((p) => p.titular).length >= 11) {
    novo.escalacao = true;
    if (est.estado === "pre") {
    const tit = meu.jogadores.filter((p) => p.titular).sort((a, b) => a.lugar - b.lugar);
    msgs.push({ titulo: "Escalação confirmada", texto: `${casa} x ${fora}\nFlamengo${meu.formacao ? " (" + meu.formacao + ")" : ""}: ${tit.map((p) => p.curto || p.nome).join(", ")}.`, prioridade: 3, tags: ["clipboard"], click: link });
    }
  }
  if (!novo.inicio && (est.estado === "in" || est.estado === "post")) {
    novo.inicio = true;
    if (est.estado === "in") msgs.push({ titulo: "Bola rolando", texto: `${casa} x ${fora}${jogo.estadio ? " · " + jogo.estadio : ""}`, prioridade: 3, tags: ["soccer"], click: link });
  }
  const total = (est.golsCasa || 0) + (est.golsFora || 0);
  if (total > novo.gols && est.estado !== "pre") {
    const golsEv = det.eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol-penalti" || e.tipo === "gol-contra").sort((a, b) => a.seg - b.seg);
    const novos = golsEv.slice(novo.gols, total);
    if (novos.length) {
      // se o jogo já terminou e vários gols chegaram de uma vez, o aviso de fim de jogo resume tudo
      if (!(est.estado === "post" && novos.length > 1)) {
        const credito = (g) => (g.tipo === "gol-contra" ? (g.time === est.casaId ? est.foraId : est.casaId) : g.time);
        for (const g of novos) {
          const idx = golsEv.indexOf(g), ate = golsEv.slice(0, idx + 1);
          const a = ate.filter((q) => credito(q) === est.casaId).length, b = ate.filter((q) => credito(q) === est.foraId).length;
          const meuGol = credito(g) === TIME;
          msgs.push({ titulo: (meuGol ? "GOL do Flamengo! " : "Gol do adversário. ") + (g.min || ""), texto: `${g.jogador}${g.tipo === "gol-penalti" ? " (pênalti)" : g.tipo === "gol-contra" ? " (contra)" : ""}\n${casa} ${a} x ${b} ${fora}`, prioridade: meuGol ? 4 : 3, tags: [meuGol ? "tada" : "x"], click: link });
        }
      }
    } else msgs.push({ titulo: "Gol", texto: placar(), prioridade: 4, tags: ["soccer"], click: link });
    novo.gols = total;
  }
  if (!novo.fim && est.estado === "post") {
    novo.fim = true;
    const meuGols = est.casaId === TIME ? est.golsCasa : est.golsFora, outro = est.casaId === TIME ? est.golsFora : est.golsCasa;
    const res = meuGols > outro ? "Vitória" : meuGols < outro ? "Derrota" : "Empate";
    const art = det.eventos.filter((e) => (e.tipo === "gol" || e.tipo === "gol-penalti") && e.time === TIME).map((e) => `${e.jogador} ${e.min}`);
    msgs.push({ titulo: `Fim de jogo: ${res}`, texto: placar() + (art.length ? "\nGols: " + art.join(", ") : ""), prioridade: 4, tags: [res === "Vitória" ? "tada" : "soccer"], click: link });
  }
  return { novo, msgs };
}

// Notícias que valem um aviso: jogo, elenco e mercado com fato concreto.
export function noticiaImportante(n) {
  if (!n || !n.titulo) return false;
  if (n.categoria === "jogo" || n.categoria === "elenco") return true;
  return n.categoria === "mercado" && /acert|fecha|oficial|proposta|renov|rescis|vend|negoci|sonda|interesse|contrat|empr[eé]stimo/i.test(n.titulo);
}

async function enviar(m) {
  const corpo = { topic: TOPICO, title: m.titulo, message: m.texto, priority: m.prioridade || 3, tags: m.tags || [], click: m.click || APP };
  if (!TOPICO) { console.log("[sem NTFY_TOPIC] ", JSON.stringify(corpo)); return false; }
  const r = await fetch(SERVIDOR, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error("ntfy respondeu " + r.status);
  return true;
}

async function principal() {
  if (process.argv.includes("--teste")) {
    await enviar({ titulo: "Teste do Radar do Flamengo", texto: "Se você viu isso, os avisos estão funcionando.", prioridade: 3, tags: ["white_check_mark"], click: APP });
    console.log("aviso de teste enviado"); return;
  }
  const agora = Date.now();
  const estado = await lerJson(ESTADO, { jogos: {}, noticias: [], iniciado: false });
  const original = JSON.stringify(estado);
  const jogos = await lerJson(new URL("../dados/jogos.json", import.meta.url), { proximos: [], resultados: [] });
  const times = await lerJson(new URL("../dados/times.json", import.meta.url), {});
  const nomes = Object.fromEntries(Object.entries(times).map(([id, t]) => [id, t.nome]));
  const fila = [];

  // 1) partidas por perto
  const candidatos = (jogos.proximos || []).concat(jogos.resultados || []).filter((j) => {
    const t = Date.parse(j.data), ja = estado.jogos[j.id];
    return agora >= t - ANTES_MIN * 60000 && agora <= t + DEPOIS_H * 3600000 && !(ja && ja.fim);
  });
  for (const j of candidatos) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${j.id}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; radar-flamengo)" } });
      if (!r.ok) throw new Error(r.status);
      const { novo, msgs } = avaliar(estado.jogos[j.id], await r.json(), j, nomes);
      estado.jogos[j.id] = novo; fila.push(...msgs);
    } catch (e) { console.error("partida", j.id, e.message); }
  }

  // 2) notícias (na primeira execução só marca as existentes, sem avisar)
  const nots = await lerJson(new URL("../noticias.json", import.meta.url), { noticias: [] });
  const vistas = new Set(estado.noticias || []);
  const novas = (nots.noticias || []).filter((n) => !vistas.has(n.id));
  const recentes = novas.filter((n) => agora - Date.parse(n.capturadoEm || n.publicadoEm || 0) < 3 * 3600000);
  if (estado.iniciado) {
    for (const n of recentes.filter(noticiaImportante).slice(0, 3)) fila.push({ titulo: n.fonte ? "Notícia · " + n.fonte : "Notícia", texto: n.titulo, prioridade: 3, tags: ["newspaper"], click: n.url || APP + "#/radar" });
  }
  for (const n of novas) vistas.add(n.id);
  estado.noticias = [...vistas].slice(-400); estado.iniciado = true;
  // limpa partidas antigas do estado
  for (const id of Object.keys(estado.jogos)) { const j = (jogos.proximos || []).concat(jogos.resultados || []).find((q) => q.id === id); if (!j || agora - Date.parse(j.data) > 3 * 864e5) delete estado.jogos[id]; }

  // 3) enviar
  let enviados = 0;
  for (const m of fila) { try { if (await enviar(m)) enviados++; } catch (e) { console.error("envio:", e.message); } }
  console.log(`${candidatos.length} partidas verificadas, ${fila.length} avisos, ${enviados} enviados`);
  if (JSON.stringify(estado) !== original) await writeFile(ESTADO, JSON.stringify(estado) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal().catch((e) => { console.error(e); process.exit(1); });
