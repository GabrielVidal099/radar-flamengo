// Radar do Flamengo: telas (Início, Jogos, Tabela, Elenco, Partida, Radar) e roteamento por hash.
import { montarRadar } from "./radar.js";

const ID = "819", TZ = "America/Sao_Paulo";
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- datas ----------
const dt = (iso, o) => new Intl.DateTimeFormat("pt-BR", Object.assign({ timeZone: TZ }, o)).format(new Date(iso));
const dia = (iso) => dt(iso, { day: "2-digit", month: "2-digit" });
const sem = (iso) => dt(iso, { weekday: "short" }).replace(".", "");
const hora = (iso) => dt(iso, { hour: "2-digit", minute: "2-digit" });
const mesAno = (iso) => { const s = dt(iso, { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const diaLongo = (iso) => dt(iso, { weekday: "long", day: "numeric", month: "long" });
function emBreve(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "agora";
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (d >= 2) return "em " + d + " dias";
  if (d === 1) return "amanhã";
  if (h >= 1) return "em " + h + " h " + String(min % 60).padStart(2, "0") + " min";
  return "em " + min + " min";
}
const haTempo = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 2) return "agora"; if (m < 60) return m + " min"; const h = Math.round(m / 60); return h < 24 ? h + " h" : Math.round(h / 24) + " d";
};

// ---------- estado ----------
let D = { jogos: null, tabela: null, elenco: null, times: {}, noticias: null };
let radar = null, ultimaAssinatura = "", subAba = "resumo", filtroComp = "todas", listaJogos = "proximos";
const cachePartidas = {};

async function pegar(url) {
  const r = await fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function carregar() {
  const [jogos, tabela, elenco, times, noticias] = await Promise.all([
    pegar("dados/jogos.json").catch(() => null), pegar("dados/tabela.json").catch(() => null), pegar("dados/elenco.json").catch(() => null),
    pegar("dados/times.json").catch(() => ({})), pegar("noticias.json").catch(() => null)
  ]);
  const assinatura = JSON.stringify([jogos && jogos.resultados && jogos.resultados.length, jogos && jogos.proximos, tabela, elenco && elenco.jogadores.length, noticias && noticias.atualizadoEm]);
  const mudou = assinatura !== ultimaAssinatura; ultimaAssinatura = assinatura;
  if (jogos) D.jogos = jogos; if (tabela) D.tabela = tabela; if (elenco) D.elenco = elenco; if (times) D.times = times; if (noticias) D.noticias = noticias;
  return mudou;
}

// ---------- peças ----------
const T = (id) => D.times[id] || { nome: "", sigla: "?", escudo: "" };
const nomeDe = (t) => T(t.id).nome || t.nome || t.sigla;
function crest(id, cls) {
  const t = T(id), c = cls || "";
  return t.escudo ? '<img class="crest ' + c + '" src="' + esc(t.escudo) + '" alt="" loading="lazy" data-sig="' + esc(t.sigla || "?") + '">' : '<span class="sig ' + c + '">' + esc(t.sigla || "?") + "</span>";
}
const selo = (cls) => '<svg class="selo ' + (cls || "") + '" aria-hidden="true"><use href="#selo"/></svg>';
const forma = (r, g) => '<span class="forma ' + r + (g ? " g" : "") + '" title="' + ({ V: "Vitória", E: "Empate", D: "Derrota" }[r]) + '">' + r + "</span>";
const comp = (j) => esc(j.competicao) + (j.fase ? " · " + esc(j.fase) : "");
const zona = (p) => (p <= 4 ? "z-lib" : p <= 6 ? "z-pre" : p <= 12 ? "z-sul" : p >= 17 ? "z-rel" : "");
const todosJogos = () => (D.jogos ? [].concat(D.jogos.proximos || [], D.jogos.resultados || []) : []);
const acharJogo = (id) => todosJogos().filter((j) => j.id === id)[0];
const minhaLinha = () => D.tabela && D.tabela.times.filter((t) => t.id === ID)[0];

function venceu(e, o, enc) { return enc && e.gols !== null && o.gols !== null && (e.gols > o.gols || (e.gols === o.gols && (e.penaltis || 0) > (o.penaltis || 0))); }
function linhaJogo(j, comComp) {
  const enc = j.status === "encerrado", c = j.casa, f = j.fora;
  const lado = (e, o) => '<div class="lin' + (venceu(e, o, enc) ? " venc" : "") + '">' + crest(e.id) + "<span>" + esc(nomeDe(e)) + "</span>" +
    (enc ? "<b>" + e.gols + (e.penaltis != null ? ' <span class="pen">(' + e.penaltis + ")</span>" : "") + "</b>" : "") + "</div>";
  const d = enc ? "<b>" + dia(j.data) + "</b>" + esc(sem(j.data)) : "<b>" + dia(j.data) + "</b>" + esc(sem(j.data)) + " " + hora(j.data);
  return '<a class="jogo" href="#/jogo/' + esc(j.id) + '"><div class="jogo-d">' + d + (comComp ? "<span>" + esc(j.competicao) + "</span>" : "") + '</div><div class="jogo-t">' + lado(c, f) + lado(f, c) + "</div>" +
    (enc && j.resultado ? forma(j.resultado) : "<span></span>") + "</a>";
}

function tabelaHtml(linhas, opc) {
  const o = opc || {}, mostrar = linhas;
  return '<table class="tab"><thead><tr><th>#</th><th class="tm">Time</th><th>J</th>' + (o.compacta ? "" : '<th class="sec">V</th><th class="sec">E</th><th class="sec">D</th>') + '<th>SG</th><th>Pts</th></tr></thead><tbody>' +
    mostrar.map((t) => '<tr class="' + (t.id === ID ? "eu" : "") + '"><td class="pos ' + zona(t.pos) + '">' + t.pos + '</td><td class="tm"><div>' + crest(t.id) + "<span>" + esc(t.nome) + "</span></div></td><td>" + t.j + "</td>" +
      (o.compacta ? "" : '<td class="sec">' + t.v + '</td><td class="sec">' + t.e + '</td><td class="sec">' + t.d + "</td>") + "<td>" + (t.sg > 0 ? "+" : "") + t.sg + '</td><td class="pts">' + t.pts + "</td></tr>").join("") + "</tbody></table>";
}
const legendaZonas = '<div class="leg"><span><i style="background:var(--z-lib)"></i>Libertadores</span><span><i style="background:var(--z-pre)"></i>Pré-Libertadores</span><span><i style="background:var(--z-sul)"></i>Sul-Americana</span><span><i style="background:var(--z-rel)"></i>Rebaixamento</span></div>';

function avatar(p, g) {
  return '<img class="avatar ' + (g ? "g" : "") + '" src="' + esc(p.foto) + '" alt="" loading="lazy" data-fb="' + esc(p.camisa || "") + '">';
}
const flag = (p) => (p.bandeira ? '<img class="flag" src="' + esc(p.bandeira) + '" alt="" loading="lazy">' : "");

function noticiasRecentes(n) {
  const lista = ((D.noticias && D.noticias.noticias) || []).filter((x) => x.categoria !== "feminino").sort((a, b) => Date.parse(b.publicadoEm || b.capturadoEm || 0) - Date.parse(a.publicadoEm || a.capturadoEm || 0)).slice(0, n);
  if (!lista.length) return '<p class="vazio">Sem notícias por enquanto.</p>';
  return lista.map((x) => {
    let u = ""; try { const p = new URL(x.url); if (p.protocol === "https:" || p.protocol === "http:") u = p.href; } catch (e) {}
    const t = "<h3>" + esc(x.titulo) + "</h3>";
    return '<div class="not"><div class="not-m"><span>' + esc(x.fonte || "") + "</span>" + (x.publicadoEm ? "<span>" + esc(haTempo(x.publicadoEm)) + "</span>" : "") + "</div>" + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + t + "</a>" : t) + "</div>";
  }).join("");
}

// ---------- telas ----------
function Inicio() {
  const J = D.jogos, L = minhaLinha();
  if (!J) return '<p class="vazio">Não deu para carregar os jogos. Confira a internet e abra de novo.</p>';
  const ult5 = (J.resultados || []).slice(0, 5).reverse(), prox = (J.proximos || [])[0];
  const hero = '<section class="card time-hero">' + crest(ID, "g") + "<div><h1>Flamengo</h1><p>Rio de Janeiro · Brasil</p>" +
    '<div class="chips">' + (L ? '<span class="chip dest">' + L.pos + 'º no Brasileirão</span><span class="chip"><b>' + L.pts + "</b> pts</span>" : "") + '<span class="formas" aria-label="Últimos 5 jogos">' + ult5.map((j) => forma(j.resultado || "E")).join("") + "</span></div></div></section>";
  const proxCard = prox ? '<a class="card prox" href="#/jogo/' + esc(prox.id) + '"><div class="prox-top"><span>' + comp(prox) + "</span><b>" + esc(emBreve(prox.data)) + '</b></div><div class="placar"><div class="eq">' + crest(prox.casa.id, "g") + "<span>" + esc(nomeDe(prox.casa)) + '</span></div><div class="meio"><b>' + hora(prox.data) + "</b><small>" + esc(sem(prox.data)) + ", " + dia(prox.data) + '</small></div><div class="eq">' + crest(prox.fora.id, "g") + "<span>" + esc(nomeDe(prox.fora)) + "</span></div></div>" +
    '<div class="prox-rodape">' + esc(prox.estadio) + (prox.cidade ? " · " + esc(prox.cidade) : "") + "</div></a>" : "";
  const ultimos = '<section class="card"><h2 class="card-t">Últimos jogos <a href="#/jogos">Ver todos</a></h2>' + (J.resultados || []).slice(0, 5).map((j) => linhaJogo(j, true)).join("") + "</section>";
  const tab = D.tabela ? (() => { const ls = D.tabela.times, i = Math.max(0, ls.findIndex((t) => t.id === ID)), ini = Math.min(Math.max(0, i - 2), Math.max(0, ls.length - 8)); return '<section class="card"><h2 class="card-t">Brasileirão <a href="#/tabela">Tabela completa</a></h2>' + tabelaHtml(ls.slice(ini, ini + 8), { compacta: true }) + "</section>"; })() : "";
  const est = L ? '<section class="card"><h2 class="card-t">Temporada no Brasileirão</h2><div class="card-b"><div class="vbar" role="img" aria-label="' + L.v + " vitórias, " + L.e + " empates, " + L.d + ' derrotas"><i class="v" style="flex:' + L.v + '"></i><i class="e" style="flex:' + L.e + '"></i><i class="d" style="flex:' + L.d + '"></i></div><div class="leg-v"><span>' + L.v + " V</span><span>" + L.e + " E</span><span>" + L.d + " D</span></div>" +
    '<div class="nums"><div><b>' + L.gp + "</b><span>Gols pró</span></div><div><b>" + L.gc + "</b><span>Gols contra</span></div><div><b>" + (L.sg > 0 ? "+" : "") + L.sg + "</b><span>Saldo</span></div><div><b>" + L.aprov + "%</b><span>Aproveit.</span></div></div></div></section>" : "";
  const E = D.elenco ? D.elenco.jogadores : [];
  const top = (campo, rotulo) => { const ls = E.filter((p) => p.temporada[campo] > 0).sort((a, b) => b.temporada[campo] - a.temporada[campo] || a.nome.localeCompare(b.nome)).slice(0, 5);
    return '<section class="card"><h2 class="card-t">' + rotulo + ' <a href="#/elenco">Elenco</a></h2>' + (ls.length ? ls.map((p) => '<button class="jog" data-jog="' + esc(p.id) + '" type="button">' + avatar(p) + '<div class="jog-n"><b>' + esc(p.nome) + "</b><span>" + esc(p.posicao) + " · " + p.temporada.jogos + ' jogos</span></div><span class="val">' + p.temporada[campo] + "</span></button>").join("") : '<p class="vazio">Sem dados.</p>') + "</section>"; };
  const noticias = '<section class="card"><h2 class="card-t">Últimas notícias <a href="#/radar">Radar</a></h2>' + noticiasRecentes(4) + "</section>";
  return '<div class="vista">' + hero + '<div class="duas"><div>' + proxCard + ultimos + est + noticias + "</div><div>" + tab + top("gols", "Artilheiros") + top("assist", "Assistências") + "</div></div></div>";
}

function Jogos() {
  const J = D.jogos; if (!J) return '<p class="vazio">Não deu para carregar os jogos.</p>';
  const base = listaJogos === "proximos" ? (J.proximos || []).slice() : (J.resultados || []).slice();
  const comps = []; todosJogos().forEach((j) => { if (comps.indexOf(j.competicao) < 0) comps.push(j.competicao); });
  const lista = base.filter((j) => filtroComp === "todas" || j.competicao === filtroComp);
  let corpo = "", mes = "";
  lista.forEach((j) => { const m = mesAno(j.data); if (m !== mes) { mes = m; corpo += '<h3 class="grupo-t">' + esc(m) + "</h3>"; } corpo += linhaJogo(j, filtroComp === "todas"); });
  return '<div class="vista"><div class="seg" role="group" aria-label="Tipo de lista"><button type="button" data-lista="proximos" aria-pressed="' + (listaJogos === "proximos") + '">Próximos</button><button type="button" data-lista="resultados" aria-pressed="' + (listaJogos === "resultados") + '">Resultados</button></div>' +
    '<div class="filtros"><button type="button" class="chip" data-comp="todas" aria-pressed="' + (filtroComp === "todas") + '">Todas</button>' + comps.map((c) => '<button type="button" class="chip" data-comp="' + esc(c) + '" aria-pressed="' + (filtroComp === c) + '">' + esc(c) + "</button>").join("") + "</div>" +
    '<section class="card">' + (corpo || '<p class="vazio">Nenhum jogo nessa lista.</p>') + "</section></div>";
}

function Tabela() {
  if (!D.tabela) return '<p class="vazio">Não deu para carregar a tabela.</p>';
  return '<div class="vista"><section class="card"><h2 class="card-t">' + esc(D.tabela.campeonato) + " " + esc(D.tabela.temporada) + "</h2>" + tabelaHtml(D.tabela.times) + legendaZonas + "</section></div>";
}

function Elenco() {
  if (!D.elenco) return '<p class="vazio">Não deu para carregar o elenco.</p>';
  const grupos = [["G", "Goleiros"], ["D", "Defensores"], ["M", "Meio-campistas"], ["F", "Atacantes"]];
  return '<div class="vista">' + grupos.map((g) => {
    const ls = D.elenco.jogadores.filter((p) => p.pos === g[0]); if (!ls.length) return "";
    return '<section class="card"><h2 class="card-t">' + g[1] + ' <span class="nota">' + ls.length + "</span></h2>" + ls.map((p) => '<button class="jog" data-jog="' + esc(p.id) + '" type="button">' + avatar(p) + '<div class="jog-n"><b>' + esc(p.nome) + "</b><span>" + (p.camisa ? "#" + esc(p.camisa) + " · " : "") + flag(p) + esc(p.pais) + (p.idade ? " · " + p.idade + " anos" : "") + (p.lesao ? ' · <i class="lesao">' + esc(p.lesao) + "</i>" : "") + '</span></div><div class="mini"><span><b>' + p.temporada.jogos + "</b> j</span><span><b>" + p.temporada.gols + "</b> g</span></div>" + "</button>").join("") + "</section>";
  }).join("") + "</div>";
}

// ---- partida ----
const ICO = {
  gol: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.4l2.4 1.8-.9 2.8H6.5l-.9-2.8z" fill="currentColor"/></svg>',
  amarelo: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="2" width="8" height="12" rx="1.6" fill="#f2c200"/></svg>',
  vermelho: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="2" width="8" height="12" rx="1.6" fill="#e5384a"/></svg>',
  troca: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13V4m0 0L2.5 6.5M5 4l2.5 2.5" stroke="#1f9d55"/><path d="M11 3v9m0 0L8.5 9.5M11 12l2.5-2.5" stroke="#d93a49"/></svg>',
  perdido: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#d93a49" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  var: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><text x="8" y="11.5" font-size="8" font-weight="800" text-anchor="middle" fill="currentColor">VAR</text></svg>'
};

function golsDoTime(d, teamId, outroId) {
  return (d.eventos || []).filter((e) => (e.tipo === "gol" || e.tipo === "gol-penalti" || e.tipo === "gol-contra") && ((e.tipo === "gol-contra" ? outroId : e.time) === teamId));
}
function textoGols(d, id, outro) {
  const por = {}; golsDoTime(d, id, outro).forEach((e) => { const n = e.jogador + (e.tipo === "gol-penalti" ? " (p)" : e.tipo === "gol-contra" ? " (contra)" : ""); (por[n] = por[n] || []).push(e.min); });
  return Object.keys(por).map((n) => "<p><b>" + esc(n) + "</b> " + por[n].map(esc).join(", ") + "</p>").join("");
}
function eventoLinha(e, casaId) {
  const esq = e.time === casaId, icone = { gol: ICO.gol, "gol-penalti": ICO.gol, "gol-contra": ICO.gol, amarelo: ICO.amarelo, vermelho: ICO.vermelho, troca: ICO.troca, "penalti-perdido": ICO.perdido, var: ICO.var }[e.tipo] || "";
  let txt = "";
  if (e.tipo === "troca") txt = "<div><b>" + esc(e.entra) + "</b><small>Sai " + esc(e.sai) + "</small></div>";
  else if (e.tipo === "gol" || e.tipo === "gol-penalti") txt = "<div><b>" + esc(e.jogador) + "</b><small>" + (e.tipo === "gol-penalti" ? "Pênalti" : e.assist ? "Assist. " + esc(e.assist) : "Gol") + "</small></div>";
  else if (e.tipo === "gol-contra") txt = "<div><b>" + esc(e.jogador) + "</b><small>Gol contra</small></div>";
  else if (e.tipo === "penalti-perdido") txt = "<div><b>" + esc(e.jogador) + "</b><small>Pênalti perdido</small></div>";
  else if (e.tipo === "var") txt = "<div><small>" + esc(e.texto) + "</small></div>";
  else txt = "<div><b>" + esc(e.jogador) + "</b></div>";
  const conteudo = esq ? '<div class="l">' + txt + icone + "</div>" : "<div></div>", dir = !esq ? '<div class="r">' + icone + txt + "</div>" : "<div></div>";
  return '<div class="ev">' + conteudo + '<div class="min">' + esc(e.min) + "</div>" + dir + "</div>";
}
function resumoPartida(d, j) {
  const evs = (d.eventos || []).slice().sort((a, b) => a.seg - b.seg);
  if (!evs.length) return '<p class="vazio">Sem lances registrados para esta partida.</p>';
  const NOMES = { 2: "2º TEMPO", 3: "PRORROGAÇÃO", 4: "PRORROGAÇÃO" };
  let out = "", atual = 1;
  evs.forEach((e) => { const per = e.periodo || (e.seg > 2700 ? 2 : 1); if (per > atual) { atual = per; out += '<div class="ev-sep">' + (NOMES[per] || "") + "</div>"; } out += eventoLinha(e, j.casa.id); });
  return '<div class="ev-sep">1º TEMPO</div>' + out;
}
function escalacoes(d, j) {
  const POS = [["G", "Goleiros"], ["D", "Defensores"], ["M", "Meio-campistas"], ["F", "Atacantes"]];
  const minutos = {}; (d.eventos || []).filter((e) => e.tipo === "troca").forEach((e) => { minutos[e.entra] = "in:" + e.min; minutos[e.sai] = "out:" + e.min; });
  const lin = (p) => {
    let ic = ""; for (let i = 0; i < p.gols; i++) ic += ICO.gol; if (p.amarelos) ic += ICO.amarelo; if (p.vermelhos) ic += ICO.vermelho;
    const m = minutos[p.nome]; if (m) ic += '<span class="ic">' + ICO.troca + esc(m.split(":")[1]) + "</span>";
    return '<div class="esc-j"><span class="n">' + esc(p.n) + '</span><span class="nm">' + esc(p.nome) + '</span><span class="ic">' + ic + "</span></div>";
  };
  return [j.casa, j.fora].map((tm) => {
    const x = (d.times || []).filter((t) => t.id === tm.id)[0]; if (!x) return "";
    const tit = x.jogadores.filter((p) => p.titular), res = x.jogadores.filter((p) => !p.titular);
    return '<div class="esc-t"><span style="display:flex;gap:8px;align-items:center">' + crest(tm.id) + esc(nomeDe(tm)) + "</span><span>" + esc(x.formacao) + "</span></div>" +
      POS.map((g) => { const ls = tit.filter((p) => p.pos === g[0]); return ls.length ? '<div class="esc-g">' + g[1] + "</div>" + ls.map(lin).join("") : ""; }).join("") +
      (res.length ? '<div class="esc-g">Reservas</div>' + res.map(lin).join("") : "") + '<div style="height:10px"></div>';
  }).join("");
}
function estatisticas(d, j) {
  const a = j.casa.id, b = j.fora.id;
  if (!d.stats || !d.stats.length) return '<p class="vazio">Sem estatísticas para esta partida.</p>';
  return d.stats.map((s) => {
    const va = s.valores[a], vb = s.valores[b]; if (va == null || vb == null) return "";
    const max = Math.max(va, vb, 1), fmt = (v) => v + (s.tipo === "%" || s.tipo === "pct" ? "%" : "");
    const cor = (id) => (id === ID ? "a" : "b");
    return '<div class="est"><div class="est-h"><span class="' + (va > vb ? "mais" : "") + '">' + fmt(va) + "</span><span>" + esc(s.nome) + '</span><span class="' + (vb > va ? "mais" : "") + '">' + fmt(vb) + '</span></div><div class="est-b"><div class="m"><i class="' + cor(a) + '" style="width:' + Math.round((va / max) * 100) + '%"></i></div><div class="m"><i class="' + cor(b) + '" style="width:' + Math.round((vb / max) * 100) + '%"></i></div></div></div>';
  }).join("");
}
function confronto(d) {
  const c = d && d.confronto; if (!c || !c.jogos || !c.jogos.length) return '<p class="vazio">Sem confrontos recentes disponíveis.</p>';
  let v = 0, e = 0, de = 0;
  c.jogos.forEach((g) => { const meu = g.casaId === ID ? g.golsCasa : g.golsFora, ou = g.casaId === ID ? g.golsFora : g.golsCasa; if (meu > ou) v++; else if (meu < ou) de++; else e++; });
  return '<h3 class="grupo-t" style="border-top:0">Últimos ' + c.jogos.length + " confrontos</h3>" +
    '<div class="h2h-resumo"><div><b style="color:var(--win)">' + v + "</b><span>Vitórias do Flamengo</span></div><div><b>" + e + "</b><span>Empates</span></div><div><b style=\"color:var(--loss)\">" + de + "</b><span>Derrotas</span></div></div>" +
    '<div class="h2h">' + c.jogos.map((g) => '<div class="h2h-r"><small>' + dia(g.data) + "/" + dt(g.data, { year: "2-digit" }) + "</small><span>" + esc(T(g.casaId).sigla || g.casa) + '</span><span class="sc">' + g.golsCasa + " - " + g.golsFora + "</span><span style=\"text-align:left\">" + esc(T(g.foraId).sigla || g.fora) + "</span></div>").join("") + "</div>";
}

function Partida(id) {
  const j = acharJogo(id);
  if (!j) return '<div class="vista"><a class="voltar" href="#/jogos">← Jogos</a><p class="vazio">Partida não encontrada.</p></div>';
  const enc = j.status === "encerrado", d = cachePartidas[id];
  if (d === undefined) {
    fetch("dados/partidas/" + encodeURIComponent(id) + ".json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((x) => { cachePartidas[id] = x; if (location.hash === "#/jogo/" + id) render(); });
  }
  const casa = j.casa, fora = j.fora;
  const meio = enc ? '<div class="meio"><b class="gols">' + casa.gols + " - " + fora.gols + "</b><small>" + (casa.penaltis != null ? "Pênaltis " + casa.penaltis + " - " + fora.penaltis : "Encerrado") + "</small></div>" : '<div class="meio"><b>' + hora(j.data) + "</b><small>" + esc(dia(j.data)) + "</small></div>";
  const golsHtml = enc && d ? '<div class="p-gols"><div>' + textoGols(d, casa.id, fora.id) + "</div><div>" + textoGols(d, fora.id, casa.id) + "</div></div>" : "";
  const cab = '<section class="card p-cab"><div class="p-comp">' + comp(j) + "<br>" + esc(diaLongo(j.data)) + " · " + hora(j.data) + (j.estadio ? "<br>" + esc(j.estadio) + (j.cidade ? " · " + esc(j.cidade) : "") : "") + '</div><div class="placar"><div class="eq">' + crest(casa.id, "g") + "<span>" + esc(nomeDe(casa)) + "</span></div>" + meio + '<div class="eq">' + crest(fora.id, "g") + "<span>" + esc(nomeDe(fora)) + "</span></div></div>" + golsHtml + "</section>";
  const abas = enc ? [["resumo", "Resumo"], ["escalacoes", "Escalações"], ["stats", "Estatísticas"], ["confronto", "Confronto"]] : [["confronto", "Confronto"]];
  const ativa = abas.some((a) => a[0] === subAba) ? subAba : abas[0][0];
  let corpo;
  if (d === undefined) corpo = '<p class="vazio">Carregando…</p>';
  else if (!d) corpo = '<p class="vazio">Os detalhes desta partida ainda não estão disponíveis.</p>';
  else corpo = ativa === "resumo" ? resumoPartida(d, j) : ativa === "escalacoes" ? escalacoes(d, j) : ativa === "stats" ? estatisticas(d, j) : confronto(d);
  return '<div class="vista"><a class="voltar" href="#/jogos">← Jogos</a>' + cab + '<section class="card"><div class="sub-abas" role="tablist">' + abas.map((a) => '<button type="button" role="tab" data-sub="' + a[0] + '" aria-selected="' + (a[0] === ativa) + '">' + a[1] + "</button>").join("") + "</div>" + corpo + "</section></div>";
}

function Radar() { return '<div class="vista" id="radar-host"></div>'; }

// ---------- painel do jogador ----------
function abrirJogador(id) {
  const p = D.elenco && D.elenco.jogadores.filter((x) => x.id === id)[0]; if (!p) return;
  const s = p.temporada, nasc = p.nascimento ? dt(p.nascimento + "T12:00:00Z", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const goleiro = p.pos === "G";
  const caixas = goleiro ? [[s.jogos, "Jogos"], [s.defesas, "Defesas"], [s.semGol, "Sem sofrer gol"], [s.golsSofridos, "Gols sofridos"], [s.amarelos, "Amarelos"], [s.vermelhos, "Vermelhos"]]
    : [[s.jogos, "Jogos"], [s.gols, "Gols"], [s.assist, "Assistências"], [s.amarelos, "Amarelos"], [s.vermelhos, "Vermelhos"], [s.jogos ? (s.gols / s.jogos).toFixed(2).replace(".", ",") : "0", "Gols por jogo"]];
  $("#camada").innerHTML = '<div class="fundo" data-fechar="1"><div class="painel" role="dialog" aria-modal="true" aria-label="' + esc(p.nome) + '"><div class="painel-top">' + avatar(p, true) + "<div><h2>" + esc(p.nome) + "</h2><p>" + (p.camisa ? "Camisa " + esc(p.camisa) + " · " : "") + esc(p.posicao) + "</p><p>" + flag(p) + " " + esc(p.pais) + (p.idade ? " · " + p.idade + " anos" : "") + '</p></div><button class="fechar" type="button" data-fechar="1" aria-label="Fechar">×</button></div>' +
    '<h3 class="grupo-t" style="padding-left:0;border:0;margin-top:14px">Temporada · todas as competições</h3><div class="dados" style="margin-top:6px">' + caixas.map((c) => "<div><b>" + c[0] + "</b><span>" + c[1] + "</span></div>").join("") + "</div>" +
    '<div class="dados">' + (nasc ? "<div><b>" + esc(nasc) + "</b><span>Nascimento</span></div>" : "") + (p.alturaCm ? "<div><b>" + p.alturaCm + " cm</b><span>Altura</span></div>" : "") + (p.pesoKg ? "<div><b>" + p.pesoKg + " kg</b><span>Peso</span></div>" : "") + "</div>" +
    (p.lesao ? '<p class="lesao" style="margin-top:12px">' + esc(p.lesao) + "</p>" : "") + "</div></div>";
  const b = $(".painel .fechar"); if (b) b.focus();
}
const fecharPainel = () => { $("#camada").innerHTML = ""; };

// ---------- roteador ----------
function rota() {
  const h = (location.hash || "#/").replace(/^#\/?/, ""), p = h.split("/");
  if (p[0] === "jogo" && p[1]) return { nome: "jogos", id: decodeURIComponent(p[1]), vista: "partida" };
  return { nome: ["jogos", "tabela", "elenco", "radar"].indexOf(p[0]) >= 0 ? p[0] : "inicio", vista: p[0] || "inicio" };
}
function render() {
  const r = rota(), app = $("#app");
  document.querySelectorAll(".aba").forEach((a) => { if (a.dataset.r === r.nome) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (radar && r.vista !== "radar") { radar.destruir(); radar = null; }
  if (r.vista === "radar") {
    if (!radar) { app.innerHTML = Radar(); radar = montarRadar($("#radar-host")); }
    radar.atualizar((D.noticias && D.noticias.noticias) || []); return;
  }
  app.innerHTML = r.vista === "partida" ? Partida(r.id) : r.vista === "jogos" ? Jogos() : r.vista === "tabela" ? Tabela() : r.vista === "elenco" ? Elenco() : Inicio();
}
function status() {
  const el = $("#status"), at = D.noticias && D.noticias.atualizadoEm, L = minhaLinha();
  $("#sub").textContent = L ? "Brasileirão · " + L.pos + "º lugar · " + L.pts + " pts" : "Brasileirão";
  if (at) { el.querySelector("span").textContent = "Atualizado há " + haTempo(at); el.classList.toggle("ok", Date.now() - Date.parse(at) < 3 * 36e5); } else el.querySelector("span").textContent = "Sem conexão";
}

// ---------- eventos ----------
window.addEventListener("hashchange", () => { fecharPainel(); render(); window.scrollTo(0, 0); });
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-jog],[data-lista],[data-comp],[data-sub],[data-fechar]"); if (!t) return;
  if (t.dataset.fechar && (t === e.target || t.classList.contains("fechar"))) { fecharPainel(); return; }
  if (t.dataset.jog) { abrirJogador(t.dataset.jog); return; }
  if (t.dataset.lista) { listaJogos = t.dataset.lista; render(); return; }
  if (t.dataset.comp) { filtroComp = t.dataset.comp; render(); return; }
  if (t.dataset.sub) { subAba = t.dataset.sub; render(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPainel(); });
// escudos e fotos que não carregam viram um círculo com a sigla ou o número
document.addEventListener("error", (e) => {
  const i = e.target; if (!i || i.tagName !== "IMG") return;
  if (i.dataset.sig !== undefined) { const s = document.createElement("span"); s.className = "sig " + i.className.replace("crest", "").trim(); s.textContent = i.dataset.sig; i.replaceWith(s); }
  else if (i.dataset.fb !== undefined) { const s = document.createElement("span"); s.className = i.className; s.textContent = i.dataset.fb; i.replaceWith(s); }
}, true);

async function iniciar() {
  await carregar(); status(); render();
  setInterval(async () => { if (document.hidden) return; if (await carregar() && !$("#camada").firstChild) render(); status(); }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", async () => { if (!document.hidden && await carregar() && !$("#camada").firstChild) render(); status(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
iniciar();
