// Coleta jogos, tabela, elenco e detalhes de partidas do Flamengo e grava em dados/*.json.
// Fonte: endpoints públicos da ESPN (sem chave). Roda no Node 20 ou mais novo: node scripts/dados.mjs
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";

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
const ESTATISTICAS = [
  ["possessionPct", "Posse de bola", "%"], ["totalShots", "Finalizações"], ["shotsOnTarget", "Finalizações no alvo"],
  ["blockedShots", "Chutes bloqueados"], ["wonCorners", "Escanteios"], ["totalPasses", "Passes"], ["passPct", "Precisão de passes", "pct"],
  ["totalCrosses", "Cruzamentos"], ["totalTackles", "Desarmes"], ["interceptions", "Interceptações"], ["totalClearance", "Cortes"],
  ["saves", "Defesas"], ["foulsCommitted", "Faltas"], ["offsides", "Impedimentos"], ["yellowCards", "Cartões amarelos"], ["redCards", "Cartões vermelhos"],
];

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
const num = (v) => { const n = Number(String(v ?? "").replace("+", "")); return Number.isFinite(n) ? n : 0; };
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

function eventosDaPartida(x, jogadores) {
  const por = (id) => jogadores.get(String(id));
  return (x.keyEvents || []).flatMap((k) => {
    const t = (k.type && k.type.type) || "", p = (k.participants || []).map((q) => q.athlete).filter(Boolean);
    const base = { min: (k.clock && k.clock.displayValue) || "", seg: (k.clock && k.clock.value) || 0, periodo: (k.period && k.period.number) || 1, time: k.team ? String(k.team.id) : "" };
    const nome = (a) => (a ? a.displayName || a.fullName : "");
    if (/own-goal/.test(t)) return [{ ...base, tipo: "gol-contra", jogador: nome(p[0]) }];
    if (/penalty/.test(t) && /(scored|goal)/.test(t) && !/miss|saved/.test(t)) return [{ ...base, tipo: "gol-penalti", jogador: nome(p[0]), assist: "" }];
    if (/penalty/.test(t) && /(miss|saved)/.test(t)) return [{ ...base, tipo: "penalti-perdido", jogador: nome(p[0]) }];
    if (/^goal/.test(t) && !k.shootout) return [{ ...base, tipo: "gol", jogador: nome(p[0]), assist: nome(p[1]) }];
    if (t === "yellow-card") return [{ ...base, tipo: "amarelo", jogador: nome(p[0]) }];
    if (t === "red-card" || t === "yellow-red-card") return [{ ...base, tipo: "vermelho", jogador: nome(p[0]) }];
    if (t === "substitution") return [{ ...base, tipo: "troca", entra: nome(p[0]), sai: nome(p[1]) }];
    if (t === "var" || /var/.test(t)) return [{ ...base, tipo: "var", texto: k.text || k.shortText || "" }];
    return [];
  });
}

const VERSAO = 2; // aumente quando o formato dos detalhes mudar: as partidas antigas são buscadas de novo

async function detalharPartida(id, jogo) {
  const x = await pegar(`${BASE}/site/v2/sports/soccer/all/summary?event=${id}`);
  const nomes = new Map();
  const times = (x.rosters || []).map((r) => {
    const lista = (r.roster || []).map((q) => {
      const a = q.athlete || {}, s = Object.fromEntries((q.stats || []).map((v) => [v.name, num(v.value)]));
      nomes.set(String(a.id), a);
      return {
        id: String(a.id), nome: a.displayName || a.fullName || "", curto: a.shortName || "", n: q.jersey || "", pos: (q.position && q.position.abbreviation) || "",
        titular: !!q.starter, entrou: !!q.subbedIn, saiu: !!q.subbedOut,
        gols: s.totalGoals || 0, assist: s.goalAssists || 0, amarelos: s.yellowCards || 0, vermelhos: s.redCards || 0, defesas: s.saves || 0, golsSofridos: s.goalsConceded || 0,
        finalizacoes: s.totalShots || 0, noAlvo: s.shotsOnTarget || 0, faltas: s.foulsCommitted || 0, jogou: s.appearances ? 1 : 0, lugar: num(q.formationPlace),
      };
    });
    return { id: String(r.team.id), formacao: r.formation || "", jogadores: lista };
  });
  const stats = ESTATISTICAS.map(([chave, nome, tipo]) => {
    const v = (x.boxscore && x.boxscore.teams || []).map((t) => {
      const e = (t.statistics || []).find((s) => s.name === chave); return e ? num(e.displayValue) : null;
    });
    const ordem = (x.boxscore && x.boxscore.teams || []).map((t) => String(t.team.id));
    return { nome, tipo: tipo || "", valores: Object.fromEntries(ordem.map((t, i) => [t, tipo === "pct" && v[i] !== null ? Math.round(v[i] * 100) : v[i]])) };
  }).filter((s) => Object.values(s.valores).some((v) => v !== null));
  const h2h = (x.seasonseries || []).find((s) => s.type === "head-to-head");
  return {
    v: VERSAO, id: String(id), ...jogo, eventos: eventosDaPartida(x, nomes), times, stats,
    publico: x.gameInfo && x.gameInfo.attendance ? x.gameInfo.attendance : null,
    confronto: h2h ? {
      
      jogos: (h2h.events || []).slice(0, 5).map((e) => {
        const cs = e.competitors || [], c = cs.find((q) => q.homeAway === "home") || cs[0], f = cs.find((q) => q.homeAway === "away") || cs[1];
        return { data: e.date, casaId: String(c.id || (c.team && c.team.id)), foraId: String(f.id || (f.team && f.team.id)), casa: (c.team && (c.team.abbreviation || c.team.displayName)) || "", fora: (f.team && (f.team.abbreviation || f.team.displayName)) || "", golsCasa: num(c.score), golsFora: num(f.score) };
      }),
    } : null,
  };
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
  const POS = { G: "Goleiro", D: "Defensor", M: "Meio-campista", F: "Atacante" };
  const jogadores = (elenco.athletes || []).map((a) => {
    const lesoes = (a.injuries || []).map((i) => i.status || i.type || "").filter(Boolean);
    return {
      id: String(a.id), nome: a.displayName || a.fullName, curto: a.shortName || a.displayName, camisa: a.jersey || "",
      pos: (a.position && a.position.abbreviation) || "", posicao: POS[(a.position && a.position.abbreviation) || ""] || (a.position && a.position.displayName) || "",
      idade: a.age || null, nascimento: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : "", pais: PAISES[a.citizenship] || a.citizenship || "", bandeira: (a.flag && a.flag.href) || "",
      alturaCm: cm(a.displayHeight), pesoKg: kg(a.displayWeight), lesao: lesoes[0] || "", foto: `https://a.espncdn.com/i/headshots/soccer/players/full/${a.id}.png`,
      temporada: soma.get(String(a.id)) || { jogos: 0, gols: 0, assist: 0, amarelos: 0, vermelhos: 0, defesas: 0, golsSofridos: 0, semGol: 0 },
    };
  }).sort((a, b) => num(a.camisa) - num(b.camisa));

  await gravar(new URL("jogos.json", PASTA), { time: TIME, proximos, resultados });
  if (tab) await gravar(new URL("tabela.json", PASTA), tab);
  await gravar(new URL("elenco.json", PASTA), { jogadores });
  await gravar(new URL("times.json", PASTA), times);
  console.log(`${resultados.length} resultados, ${proximos.length} próximos, ${jogadores.length} jogadores, ${Object.keys(times).length} times`);
}

main().catch((e) => { console.error(e); process.exit(1); });
