// Coleta jogos, tabela, elenco e detalhes de partidas do Flamengo e grava em dados/*.json.
// Fonte: endpoints públicos da ESPN (sem chave). Roda no Node 20 ou mais novo: node scripts/dados.mjs
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { VERSAO, num, detalharResumo } from "../espn.js";
import { calendarioIcs } from "../calendario.js";

const TIME = "819"; // id do Flamengo na ESPN
const BASE = "https://site.api.espn.com/apis";
const PASTA = new URL("../dados/", import.meta.url);
const PARTIDAS = new URL("../dados/partidas/", import.meta.url);

const COMPETICOES = {
  "Brazilian Serie A": "Brasileirão", "CONMEBOL Libertadores": "Libertadores", "Brazilian Campeonato Carioca": "Carioca",
  "Copa do Brasil": "Copa do Brasil", "CONMEBOL Recopa": "Recopa", "Brazilian Supercopa Rei": "Supercopa do Brasil",
};
const FASES = {
  "Group Stage": "Fase de grupos", "Round of 16": "Oitavas de final", "Quarterfinals": "Quartas de final", "Semifinals": "Semifinal", "Final": "Final",
  "Fifth Round": "Quinta fase", "Taça Guanabara": "Taça Guanabara", "Taça Guanabara - Quarterfinals": "Taça Guanabara · quartas",
  "Taça Guanabara - Semifinals": "Taça Guanabara · semifinal", "Taça Guanabara - Final": "Taça Guanabara · final",
};

async function pegar(url, tentativas = 3) {
  let erro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; radar-flamengo)" } });
      if (r.ok) return await r.json();
      erro = new Error(`${r.status} em ${url}`);
      if (r.status === 404 || r.status === 400) break;
    } catch (e) { erro = e; }
    await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
  }
  throw erro;
}
async function lerJson(url, padrao) { try { return JSON.parse(await readFile(url, "utf8")); } catch { return padrao; } }
const gravar = (url, obj) => writeFile(url, JSON.stringify(obj) + "\n");
const escudo = (id) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=96&h=96`;

function time(c) {
  const t = c.team || {};
  const gols = c.score && typeof c.score === "object" ? c.score.displayValue : c.score;
  return {
    id: String(t.id), nome: t.displayName || t.name || "", sigla: t.abbreviation || "",
    gols: gols === undefined || gols === "" ? null : num(gols),
    penaltis: c.score && c.score.shootoutScore !== undefined ? num(c.score.shootoutScore) : null,
  };
}

function normalizarEvento(e) {
  const c = e.competitions[0], comp = c.competitors;
  const casa = comp.find((x) => x.homeAway === "home") || comp[0], fora = comp.find((x) => x.homeAway === "away") || comp[1];
  const liga = (e.league && e.league.name) || "";
  const fase = e.seasonType && e.seasonType.name ? e.seasonType.name.trim() : "";
  const st = c.status && c.status.type ? c.status.type : {};
  const encerrado = !!st.completed || /FULL_TIME|FINAL/.test(st.name || "");
  const j = {
    id: String(e.id), data: e.date.length === 16 ? e.date + ":00Z" : e.date,
    competicao: COMPETICOES[liga] || liga, fase: /^\d{4} /.test(fase) || fase === (COMPETICOES[liga] || "") ? "" : (FASES[fase] || fase),
    estadio: (c.venue && c.venue.fullName) || "", cidade: (c.venue && c.venue.address && c.venue.address.city) || "",
    status: encerrado ? "encerrado" : /IN_PROGRESS|HALF|LIVE/.test(st.name || "") ? "ao-vivo" : "agendado",
    detalhe: st.shortDetail || st.detail || "",
    casa: time(casa), fora: time(fora),
    transmissao: (c.broadcasts || []).flatMap((b) => b.names || []).slice(0, 3),
  };
  const meu = j.casa.id === TIME ? j.casa : j.fora, outro = meu === j.casa ? j.fora : j.casa;
  if (encerrado && meu.gols !== null && outro.gols !== null) {
    j.resultado = meu.gols > outro.gols ? "V" : meu.gols < outro.gols ? "D" : "E";
    if (meu.gols === outro.gols && meu.penaltis !== null && outro.penaltis !== null) j.resultado = meu.penaltis > outro.penaltis ? "V" : "D";
  }
  return j;
}

async function detalharPartida(id, jogo) {
  return detalharResumo(await pegar(`${BASE}/site/v2/sports/soccer/all/summary?event=${id}`), jogo);
}

async function tabela() {
  const x = await pegar(`${BASE}/v2/sports/soccer/bra.1/standings`);
  const linhas = x.children[0].standings.entries.map((e) => {
    const s = Object.fromEntries(e.stats.map((v) => [v.name, v.value]));
    const j = num(s.gamesPlayed), pts = num(s.points);
    return {
      pos: num(s.rank), id: String(e.team.id), nome: e.team.displayName, sigla: e.team.abbreviation || "",
      j, v: num(s.wins), e: num(s.ties), d: num(s.losses), gp: num(s.pointsFor), gc: num(s.pointsAgainst), sg: num(s.pointDifferential), pts,
      aprov: j ? Math.round((pts / (j * 3)) * 100) : 0,
    };
  }).sort((a, b) => a.pos - b.pos);
  return { temporada: (x.children[0].name || "2026").trim(), campeonato: "Brasileirão", times: linhas };
}

async function main() {
  await mkdir(PARTIDAS, { recursive: true });
  const [res, prox, tab, elenco] = await Promise.all([
    pegar(`${BASE}/site/v2/sports/soccer/all/teams/${TIME}/schedule`),
    pegar(`${BASE}/site/v2/sports/soccer/all/teams/${TIME}/schedule?fixture=true`).catch(() => ({ events: [] })),
    tabela().catch((e) => { console.error("tabela:", e.message); return null; }),
    pegar(`${BASE}/site/v2/sports/soccer/bra.1/teams/${TIME}/roster`),
  ]);
  const vistos = new Set(), todos = [];
  for (const e of [...(res.events || []), ...(prox.events || [])]) { if (vistos.has(e.id)) continue; vistos.add(e.id); todos.push(normalizarEvento(e)); }
  todos.sort((a, b) => a.data.localeCompare(b.data));
  const resultados = todos.filter((j) => j.status === "encerrado").reverse();
  const proximos = todos.filter((j) => j.status !== "encerrado");

  // escudos usados no app
  const times = {};
  for (const j of todos) for (const t of [j.casa, j.fora]) times[t.id] = { id: t.id, nome: t.nome, sigla: t.sigla, escudo: escudo(t.id) };
  if (tab) for (const l of tab.times) times[l.id] = { id: l.id, nome: l.nome, sigla: l.sigla, escudo: escudo(l.id) };

  // detalhes: só o que ainda não existe, e sempre o dos próximos 2 jogos (confronto direto)
  const existentes = new Set();
  for (const f of await readdir(PARTIDAS)) { const d = await lerJson(new URL(f, PARTIDAS), null); if (d && d.v === VERSAO) existentes.add(f.replace(".json", "")); }
  const pedir = [...resultados.filter((j) => !existentes.has(j.id)), ...proximos.slice(0, 2)];
  let feitos = 0, falhas = 0;
  const fila = [...pedir];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (fila.length) {
      const j = fila.shift();
      try { await gravar(new URL(`${j.id}.json`, PARTIDAS), await detalharPartida(j.id, j)); feitos++; }
      catch (e) { falhas++; console.error("partida", j.id, e.message); }
    }
  }));
  console.log(`partidas detalhadas: ${feitos} novas, ${falhas} falhas`);

  // elenco com estatísticas da temporada (soma das partidas já detalhadas)
  const soma = new Map();
  for (const j of resultados) {
    const d = await lerJson(new URL(`${j.id}.json`, PARTIDAS), null); if (!d) continue;
    const meu = (d.times || []).find((t) => t.id === TIME); if (!meu) continue;
    for (const p of meu.jogadores) {
      const s = soma.get(p.id) || { jogos: 0, gols: 0, assist: 0, amarelos: 0, vermelhos: 0, defesas: 0, golsSofridos: 0, semGol: 0 };
      if (p.titular || p.entrou) {
        s.jogos++; s.gols += p.gols; s.assist += p.assist; s.amarelos += p.amarelos; s.vermelhos += p.vermelhos; s.defesas += p.defesas; s.golsSofridos += p.golsSofridos;
        if (p.pos === "G" && p.titular && p.golsSofridos === 0) s.semGol++;
      }
      soma.set(p.id, s);
    }
  }
  const PAISES = { Brazil: "Brasil", Argentina: "Argentina", Uruguay: "Uruguai", Chile: "Chile", Colombia: "Colômbia", Peru: "Peru", Ecuador: "Equador", Paraguay: "Paraguai", Venezuela: "Venezuela", Bolivia: "Bolívia", Spain: "Espanha", Italy: "Itália", Portugal: "Portugal", France: "França", Germany: "Alemanha", Mexico: "México", Panama: "Panamá", Netherlands: "Países Baixos" };
  const cm = (t) => { const m = /(\d+)'\s*(\d+)?/.exec(t || ""); return m ? Math.round((Number(m[1]) * 12 + Number(m[2] || 0)) * 2.54) : null; };
  const kg = (t) => { const m = /(\d+)\s*lbs/.exec(t || ""); return m ? Math.round(Number(m[1]) * 0.4536) : null; };
  // contagem de cartões no Brasileirão, jogo a jogo
  const cartoes = new Map(), ligaJogos = resultados.filter((j) => j.competicao === "Brasileirão").reverse();
  let ultimaLiga = null;
  for (const j of ligaJogos) {
    const d = await lerJson(new URL(`${j.id}.json`, PARTIDAS), null); if (!d) continue;
    const meu = (d.times || []).find((t) => t.id === TIME); if (!meu) continue;
    ultimaLiga = j.id;
    for (const p of meu.jogadores) {
      const c = cartoes.get(p.id) || { total: 0, serie: 0, suspenso: "" };
      c.suspenso = ""; // a suspensão do jogo anterior já foi cumprida neste
      if (p.vermelhos > 0) c.suspenso = "expulso";
      else if (p.amarelos > 0) { c.total += p.amarelos; c.serie += p.amarelos; if (c.serie >= 3) { c.serie = 0; c.suspenso = "3º amarelo"; } }
      cartoes.set(p.id, c);
    }
    // quem não entrou na súmula nesse jogo cumpriu a suspensão (se tinha) e a perde
    for (const [id, c] of cartoes) if (!meu.jogadores.some((p) => p.id === id)) c.suspenso = "";
  }
  const POS = { G: "Goleiro", D: "Defensor", M: "Meio-campista", F: "Atacante" };
  const jogadores = (elenco.athletes || []).map((a) => {
    const lesoes = (a.injuries || []).map((i) => i.status || i.type || "").filter(Boolean);
    return {
      id: String(a.id), nome: a.displayName || a.fullName, curto: a.shortName || a.displayName, camisa: a.jersey || "",
      pos: (a.position && a.position.abbreviation) || "", posicao: POS[(a.position && a.position.abbreviation) || ""] || (a.position && a.position.displayName) || "",
      idade: a.age || null, nascimento: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : "", pais: PAISES[a.citizenship] || a.citizenship || "", bandeira: (a.flag && a.flag.href) || "",
      alturaCm: cm(a.displayHeight), pesoKg: kg(a.displayWeight), lesao: lesoes[0] || "", foto: `https://a.espncdn.com/i/headshots/soccer/players/full/${a.id}.png`,
      cartoes: (() => { const c = cartoes.get(String(a.id)); return c ? { amarelos: c.total, serie: c.serie, pendurado: c.serie === 2 && !c.suspenso, suspenso: c.suspenso } : { amarelos: 0, serie: 0, pendurado: false, suspenso: "" }; })(),
      temporada: soma.get(String(a.id)) || { jogos: 0, gols: 0, assist: 0, amarelos: 0, vermelhos: 0, defesas: 0, golsSofridos: 0, semGol: 0 },
    };
  }).sort((a, b) => num(a.camisa) - num(b.camisa));

  await writeFile(new URL("../calendario.ics", import.meta.url), calendarioIcs(proximos, (t) => (times[t.id] && times[t.id].nome) || t.nome || t.sigla));
  await gravar(new URL("jogos.json", PASTA), { time: TIME, proximos, resultados });
  if (tab) await gravar(new URL("tabela.json", PASTA), tab);
  await gravar(new URL("elenco.json", PASTA), { jogadores });
  await gravar(new URL("times.json", PASTA), times);
  console.log(`${resultados.length} resultados, ${proximos.length} próximos, ${jogadores.length} jogadores, ${Object.keys(times).length} times`);
}

main().catch((e) => { console.error(e); process.exit(1); });
