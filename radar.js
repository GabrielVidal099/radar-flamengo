// Radar de notícias: o Maracanã em 3D (ou o mapa 2D) com cada notícia como um marcador, mais a lista de notícias.
const CATS = [
  { id: "jogo", nome: "Jogo" },
  { id: "mercado", nome: "Mercado" },
  { id: "elenco", nome: "Elenco" },
  { id: "bastidores", nome: "Bastidores" },
  { id: "outros", nome: "+ Esportes" }
];
const R = 165, DIAS = 7, SVGNS = "http://www.w3.org/2000/svg", K = 0.78;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tempo = (it) => { const t = Date.parse(it.publicadoEm || it.capturadoEm || ""); return isNaN(t) ? 0 : t; };
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const catIndex = (id) => { for (let i = 0; i < CATS.length; i++) if (CATS[i].id === id) return i; return CATS.length - 1; };
const escala = (dias) => R * Math.log(1 + dias * 24) / Math.log(1 + DIAS * 24);
function ha(t) {
  if (!t) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return "há " + Math.max(1, m) + " min";
  const h = Math.round(m / 60); if (h < 24) return "há " + h + " h";
  const d = Math.round(h / 24); return d === 1 ? "ontem" : "há " + d + " dias";
}
function dataCerta(it) {
  const o = { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" };
  if (!it.semHora) { o.hour = "2-digit"; o.minute = "2-digit"; }
  return new Date(tempo(it)).toLocaleString("pt-BR", o).replace(",", "");
}
const urlSegura = (u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch (e) { return null; } };
const svg = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

export function montarRadar(host, opcoes) {
  const op = opcoes || {};
  let itens = [], filtro = "todas", termo = "", quente = null, modo = "3d";
  let est3d = null, carregando3d = false, falhou3d = false, morto = false;
  let ultimaVisita = 0;
  try { ultimaVisita = Number(localStorage.getItem("radar:visita")) || 0; } catch (e) {}
  try { filtro = localStorage.getItem("radar:filtro") || "todas"; if (filtro !== "todas" && !CATS.some((c) => c.id === filtro)) filtro = "todas"; } catch (e) {}
  try { modo = localStorage.getItem("radar:modo") === "2d" ? "2d" : "3d"; } catch (e) {}

  host.innerHTML = '<div class="radar-grid">' +
    '<div class="radar-col"><div class="radar">' +
    '<div class="r3d" hidden></div>' +
    '<div class="vistas" role="group" aria-label="Tipo de radar"><button type="button" class="vbtn" data-m="3d">3D</button><button type="button" class="vbtn" data-m="2d">Mapa</button></div>' +
    '<svg class="mapa" viewBox="-225 -180 450 360" role="img" aria-label="Mapa do Maracanã visto de cima com as notícias: quanto mais perto do gramado, mais recente"></svg>' +
    '</div><p class="legenda"></p></div>' +
    '<div class="feed-col"><div class="tools" style="display:grid;gap:10px">' +
    '<input class="busca" type="search" placeholder="Buscar por jogador, jornalista ou fonte" aria-label="Buscar notícias">' +
    '<div class="filtros"></div></div>' +
    '<div class="card feed" style="margin-top:12px"></div><p class="nota" hidden style="margin-top:8px"></p></div></div>';
  const $ = (s) => host.querySelector(s);
  const el3d = $(".r3d"), elSvg = $(".mapa"), elLeg = $(".legenda"), elFeed = $(".feed"), elChips = $(".filtros"), elNota = $(".nota"), elBusca = $(".busca");

  function visiveis() {
    const q = termo.trim().toLowerCase();
    return itens.filter((it) => {
      if (filtro !== "todas" && CATS[catIndex(it.categoria)].id !== filtro) return false;
      if (!q) return true;
      return (it.titulo + " " + (it.resumo || "") + " " + (it.fonte || "") + " " + (it.jornalista || "")).toLowerCase().indexOf(q) >= 0;
    });
  }

  function desenharMapa(vis) {
    const s = elSvg; s.textContent = "";
    const seg = 360 / CATS.length;
    [[7, "#1c1114"], [3, "#251519"], [1, "#2f1a20"], [0.25, "#143326"]].forEach((b) => s.appendChild(svg("ellipse", { rx: escala(b[0]), ry: escala(b[0]) * K, fill: b[1] })));
    s.appendChild(svg("ellipse", { class: "roof", rx: R + 9, ry: (R + 9) * K }));
    [1, 3].forEach((d) => s.appendChild(svg("ellipse", { class: "ring", rx: escala(d), ry: escala(d) * K })));
    s.appendChild(svg("ellipse", { class: "rim", rx: R, ry: R * K }));
    const pw = 86, ph = 54;
    s.appendChild(svg("rect", { class: "pitch-line", x: -pw / 2, y: -ph / 2, width: pw, height: ph }));
    s.appendChild(svg("line", { class: "pitch-line", x1: 0, y1: -ph / 2, x2: 0, y2: ph / 2 }));
    s.appendChild(svg("circle", { class: "pitch-line", r: 8 }));
    [-1, 1].forEach((l) => s.appendChild(svg("rect", { class: "pitch-line", x: l < 0 ? -pw / 2 : pw / 2 - 14, y: -13, width: 14, height: 26 })));
    s.appendChild(svg("ellipse", { class: "ring", rx: escala(0.25), ry: escala(0.25) * K }));
    [0.25, 1, 3, 7].forEach((d) => {
      const t = svg("text", { class: "rlabel", x: 4, y: -escala(d) * K + 11 });
      t.textContent = d < 1 ? "6 h" : d === 1 ? "24 h" : d + " dias"; s.appendChild(t);
    });
    CATS.forEach((c, i) => {
      const a = (-90 - seg / 2 + i * seg) * Math.PI / 180, r0 = escala(0.25);
      s.appendChild(svg("line", { class: "spoke", x1: r0 * Math.cos(a), y1: r0 * Math.sin(a) * K, x2: R * Math.cos(a), y2: R * Math.sin(a) * K }));
      const m = (-90 + i * seg) * Math.PI / 180, lado = Math.cos(m) > 0.1 ? 1 : Math.cos(m) < -0.1 ? -1 : 0;
      const t = svg("text", { class: "slabel" + (filtro === c.id ? " on" : ""), x: lado ? lado * 221 : 0, y: lado ? (Math.sin(m) > 0 ? 100 : -92) : 158 * Math.sin(m) + 4, "text-anchor": lado > 0 ? "end" : lado < 0 ? "start" : "middle" });
      t.textContent = c.nome.toUpperCase();
      t.addEventListener("click", () => escolher(filtro === c.id ? "todas" : c.id));
      s.appendChild(t);
    });
    const sq = svg("g", { transform: "scale(1 " + K + ")" }), g = svg("g", { class: "sweep" }), a2 = 50 * Math.PI / 180;
    g.appendChild(svg("path", { d: "M0 0 L" + R + " 0 A" + R + " " + R + " 0 0 0 " + (R * Math.cos(a2)) + " " + (-R * Math.sin(a2)) + " Z", fill: "#ff3b55", "fill-opacity": ".13" }));
    g.appendChild(svg("line", { x1: 0, y1: 0, x2: R, y2: 0, stroke: "#ff3b55", "stroke-opacity": ".7", "stroke-width": 1.5 }));
    sq.appendChild(g); s.appendChild(sq);
    const ids = {}; vis.forEach((it) => { ids[it.id] = 1; });
    itens.forEach((it) => {
      const t = tempo(it); if (!t) return;
      const dias = Math.min(DIAS, Math.max(0, (Date.now() - t) / 864e5)), h = hash(it.id);
      const ang = (-90 - seg / 2 + catIndex(it.categoria) * seg + seg * (0.15 + 0.7 * ((h % 1000) / 1000))) * Math.PI / 180;
      const r = Math.max(10, escala(dias) - 5), x = r * Math.cos(ang), y = r * Math.sin(ang) * K;
      const g2 = svg("g", { class: "blip-g" + (quente === it.id ? " hot" : ""), tabindex: 0, role: "button", "data-id": it.id });
      const ti = svg("title", {}); ti.textContent = it.titulo; g2.appendChild(ti);
      g2.appendChild(svg("circle", { class: "blip-halo", cx: x, cy: y, r: 11 }));
      g2.appendChild(svg("circle", { cx: x, cy: y, r: 14, fill: "transparent" }));
      g2.appendChild(svg("circle", { class: "blip" + (ids[it.id] ? "" : " dim"), cx: x, cy: y, r: 5.5 }));
      const ir = () => irPara(it.id);
      g2.addEventListener("click", ir);
      g2.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } });
      s.appendChild(g2);
    });
  }

  function itens3d(vis) {
    const ids = {}; vis.forEach((it) => { ids[it.id] = 1; });
    return itens.filter((it) => tempo(it)).map((it) => {
      const dias = Math.min(DIAS, Math.max(0, (Date.now() - tempo(it)) / 864e5));
      return { id: it.id, titulo: it.titulo, cat: catIndex(it.categoria), rho: escala(dias) / R, frac: (hash(it.id) % 1000) / 1000, vis: !!ids[it.id], hot: quente === it.id };
    });
  }

  function aplicarModo() {
    const ver3d = modo === "3d" && !!est3d && !falhou3d;
    el3d.hidden = !ver3d; elSvg.style.display = ver3d ? "none" : "block";
    host.querySelectorAll(".vbtn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === modo)));
    elLeg.textContent = ver3d
      ? "O Maracanã em 3D. Cada marcador é uma notícia: no gramado, as das últimas 6 horas; nas arquibancadas, as de até 24 h, 3 e 7 dias. Arraste para girar, use dois dedos ou a roda do mouse para aproximar e toque em um marcador para ir até a notícia."
      : "Mapa do estádio visto de cima. Cada ponto é uma notícia: no gramado, as das últimas 6 horas; nas arquibancadas, as de até 24 h, 3 e 7 dias. Toque em um ponto para ir até ela.";
    if (est3d && ver3d) { est3d.resize(); est3d.update(itens3d(visiveis())); }
  }
  function garantir3d() {
    if (est3d || carregando3d || falhou3d || morto) return;
    let ok = false;
    try { const c = document.createElement("canvas"); ok = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) {}
    if (!ok) { falhou3d = true; aplicarModo(); return; }
    carregando3d = true;
    import("./stadium3d.js").then((m) => {
      if (morto) return;
      el3d.hidden = false;
      est3d = m.createStadium(el3d, {
        logoUrl: "icons/monograma.png", setores: CATS.map((c) => c.nome),
        onPick: (id) => irPara(id), onSector: (i) => escolher(filtro === CATS[i].id ? "todas" : CATS[i].id)
      });
      carregando3d = false; aplicarModo();
    }).catch(() => { falhou3d = true; carregando3d = false; el3d.hidden = true; aplicarModo(); });
  }
  host.querySelectorAll(".vbtn").forEach((b) => b.addEventListener("click", () => {
    modo = b.dataset.m; try { localStorage.setItem("radar:modo", modo); } catch (e) {}
    aplicarModo(); if (modo === "3d") garantir3d();
  }));

  function irPara(id) {
    const it = itens.filter((x) => x.id === id)[0]; if (!it) return;
    if (visiveis().indexOf(it) < 0) { filtro = "todas"; termo = ""; elBusca.value = ""; }
    quente = id; render();
    const li = host.querySelector('.not[data-id="' + CSS.escape(id) + '"]');
    if (li) li.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }
  function escolher(id) { filtro = id; try { localStorage.setItem("radar:filtro", id); } catch (e) {} render(); }

  function desenharChips() {
    elChips.textContent = "";
    const cont = {}; itens.forEach((it) => { const c = CATS[catIndex(it.categoria)].id; cont[c] = (cont[c] || 0) + 1; });
    [{ id: "todas", nome: "Todas" }].concat(CATS).forEach((c) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip";
      b.setAttribute("aria-pressed", String(filtro === c.id)); b.textContent = c.nome + " ";
      const n = document.createElement("b"); n.textContent = String(c.id === "todas" ? itens.length : (cont[c.id] || 0)); b.appendChild(n);
      b.addEventListener("click", () => escolher(c.id)); elChips.appendChild(b);
    });
  }

  function desenharFeed(vis) {
    if (!vis.length) {
      elFeed.innerHTML = '<p class="vazio">' + (itens.length ? "Nada nesse filtro. Tente outra editoria ou limpe a busca." : "Nenhuma notícia no radar ainda. A próxima varredura roda em até 30 minutos.") + "</p>"; return;
    }
    elFeed.innerHTML = vis.map((it) => {
      const u = urlSegura(it.url), cap = Date.parse(it.capturadoEm || "");
      const meta = '<span class="cat">' + esc(CATS[catIndex(it.categoria)].nome) + "</span>" +
        (it.fonte ? "<span>" + esc(it.fonte) + "</span>" : "") +
        (it.jornalista ? '<span class="rep">Apuração: ' + esc(it.jornalista) + "</span>" : "") +
        "<span>" + (it.publicadoEm ? esc(dataCerta(it)) + " · " + esc(ha(tempo(it))) : "data não informada") + "</span>" +
        (ultimaVisita && cap > ultimaVisita ? '<span class="novo">novo</span>' : "");
      const t = u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"><h3>' + esc(it.titulo) + "</h3></a>" : "<h3>" + esc(it.titulo) + "</h3>";
      return '<div class="not' + (quente === it.id ? " hot" : "") + '" data-id="' + esc(it.id) + '"><div class="not-m">' + meta + "</div>" + t + (it.resumo ? "<p>" + esc(it.resumo) + "</p>" : "") + "</div>";
    }).join("");
  }

  function render() {
    if (morto) return;
    const vis = visiveis();
    desenharChips(); desenharMapa(vis); if (est3d) est3d.update(itens3d(vis)); desenharFeed(vis);
  }

  elBusca.addEventListener("input", (e) => { termo = e.target.value; render(); });

  function atualizar(lista) {
    itens = (lista || []).filter((x) => x.categoria !== "feminino").map((x) => ({
      id: String(x.id), titulo: String(x.titulo || "Sem título"), resumo: x.resumo ? String(x.resumo) : "", fonte: x.fonte ? String(x.fonte) : "",
      url: x.url, jornalista: x.jornalista ? String(x.jornalista) : "", categoria: String(x.categoria || "outros"),
      semHora: !!x.semHora, publicadoEm: x.publicadoEm || null, capturadoEm: x.capturadoEm || null
    }));
    itens.sort((a, b) => tempo(b) - tempo(a));
    render();
  }

  aplicarModo(); render();
  if (modo === "3d") garantir3d();
  try { setTimeout(() => localStorage.setItem("radar:visita", String(Date.now())), 4000); } catch (e) {}

  return {
    atualizar,
    destruir() { morto = true; if (est3d) { try { est3d.dispose(); } catch (e) {} } host.textContent = ""; }
  };
}
