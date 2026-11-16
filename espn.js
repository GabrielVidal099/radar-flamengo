// Leitura dos dados de uma partida (resumo da ESPN). Usado pelo robô do GitHub (Node) e pelo app (navegador).
export const VERSAO = 2; // aumente quando o formato dos detalhes mudar: as partidas antigas são buscadas de novo
export const num = (v) => { const n = Number(String(v == null ? "" : v).replace("+", "")); return Number.isFinite(n) ? n : 0; };

const ESTATISTICAS = [
  ["possessionPct", "Posse de bola", "%"], ["totalShots", "Finalizações"], ["shotsOnTarget", "Finalizações no alvo"],
  ["blockedShots", "Chutes bloqueados"], ["wonCorners", "Escanteios"], ["totalPasses", "Passes"], ["passPct", "Precisão de passes", "pct"],
  ["totalCrosses", "Cruzamentos"], ["totalTackles", "Desarmes"], ["interceptions", "Interceptações"], ["totalClearance", "Cortes"],
  ["saves", "Defesas"], ["foulsCommitted", "Faltas"], ["offsides", "Impedimentos"], ["yellowCards", "Cartões amarelos"], ["redCards", "Cartões vermelhos"],
];

export function eventosDaPartida(x) {
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
    if (/var/.test(t)) return [{ ...base, tipo: "var", texto: k.text || k.shortText || "" }];
    return [];
  });
}

// Transforma o resumo bruto de uma partida no formato compacto do app. `jogo` traz os dados básicos (data, times, competição).
export function detalharResumo(x, jogo) {
  const times = (x.rosters || []).map((r) => {
    const lista = (r.roster || []).map((q) => {
      const a = q.athlete || {}, s = Object.fromEntries((q.stats || []).map((v) => [v.name, num(v.value)]));
      return {
        id: String(a.id), nome: a.displayName || a.fullName || "", curto: a.shortName || "", n: q.jersey || "", pos: (q.position && q.position.abbreviation) || "",
        titular: !!q.starter, entrou: !!q.subbedIn, saiu: !!q.subbedOut,
        gols: s.totalGoals || 0, assist: s.goalAssists || 0, amarelos: s.yellowCards || 0, vermelhos: s.redCards || 0, defesas: s.saves || 0, golsSofridos: s.goalsConceded || 0,
        finalizacoes: s.totalShots || 0, noAlvo: s.shotsOnTarget || 0, faltas: s.foulsCommitted || 0, jogou: s.appearances ? 1 : 0, lugar: num(q.formationPlace),
      };
    });
    return { id: String(r.team.id), formacao: r.formation || "", jogadores: lista };
  });
  const ordem = ((x.boxscore && x.boxscore.teams) || []).map((t) => String(t.team.id));
  const stats = ESTATISTICAS.map(([chave, nome, tipo]) => {
    const v = ((x.boxscore && x.boxscore.teams) || []).map((t) => { const e = (t.statistics || []).find((s) => s.name === chave); return e ? num(e.displayValue) : null; });
    return { nome, tipo: tipo || "", valores: Object.fromEntries(ordem.map((t, i) => [t, tipo === "pct" && v[i] !== null ? Math.round(v[i] * 100) : v[i]])) };
  }).filter((s) => Object.values(s.valores).some((v) => v !== null));
  const h2h = (x.seasonseries || []).find((s) => s.type === "head-to-head");
  return {
    v: VERSAO, id: String((jogo && jogo.id) || (x.header && x.header.id) || ""), ...(jogo || {}), eventos: eventosDaPartida(x), times, stats,
    publico: x.gameInfo && x.gameInfo.attendance ? x.gameInfo.attendance : null,
    confronto: h2h ? {
      placar: h2h.seriesScore || "",
      jogos: (h2h.events || []).slice(0, 5).map((e) => {
        const cs = e.competitors || [], c = cs.find((q) => q.homeAway === "home") || cs[0], f = cs.find((q) => q.homeAway === "away") || cs[1];
        return { data: e.date, casaId: String(c.id || (c.team && c.team.id)), foraId: String(f.id || (f.team && f.team.id)), casa: (c.team && (c.team.abbreviation || c.team.displayName)) || "", fora: (f.team && (f.team.abbreviation || f.team.displayName)) || "", golsCasa: num(c.score), golsFora: num(f.score) };
      }),
    } : null,
  };
}

// Situação da partida agora: pré-jogo, em andamento ou encerrada, com placar e minuto.
export function estadoAoVivo(x) {
  const c = x.header && x.header.competitions && x.header.competitions[0]; if (!c) return null;
  const st = (c.status && c.status.type) || {}, comp = c.competitors || [];
  const casa = comp.find((q) => q.homeAway === "home") || comp[0], fora = comp.find((q) => q.homeAway === "away") || comp[1];
  if (!casa || !fora) return null;
  const gols = (q) => (q.score === undefined || q.score === "" || q.score === null ? null : num(q.score));
  return {
    estado: st.state || "pre", completo: !!st.completed, detalhe: st.shortDetail || st.detail || "", relogio: (c.status && c.status.displayClock) || "", periodo: (c.status && c.status.period) || 0,
    casaId: String(casa.id || (casa.team && casa.team.id)), foraId: String(fora.id || (fora.team && fora.team.id)),
    golsCasa: gols(casa), golsFora: gols(fora),
    penCasa: casa.shootoutScore !== undefined ? num(casa.shootoutScore) : null, penFora: fora.shootoutScore !== undefined ? num(fora.shootoutScore) : null,
  };
}
