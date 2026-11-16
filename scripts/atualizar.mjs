// Varre o Google Notícias atrás de manchetes do Flamengo e atualiza noticias.json.
// Roda sem dependências, no Node 20 ou mais novo: node scripts/atualizar.mjs
import { readFile, writeFile } from "node:fs/promises";

const ARQUIVO = new URL("../noticias.json", import.meta.url);
const FEEDS = [
  "https://news.google.com/rss/search?q=Flamengo+when:1d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=Flamengo+%22Ven%C3%AA+Casagrande%22+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=Flamengo+%22Pablo+Raphael%22+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
];
const DIAS_GUARDADOS = 10;
const MAX_NOVAS = 12;
const JANELA_HORAS = 26;

// Fontes preferidas, da mais para a menos confiável. Quem não está na lista vem depois.
const PREFERIDAS = ["ge", "UOL", "LANCE!", "O Dia", "ESPN Brasil", "Coluna do Fla", "Clube de Regatas do Flamengo", "Terra", "CNN Brasil", "Gazeta Esportiva", "G1", "O Globo", "Extra", "Trivela", "Band", "Metrópoles"];
const FONTES_FORA = /instagram|facebook|youtube|tiktok|threads|x\.com|twitter|^flamengo\.com\.br$|onefootball|msn|reddit/i;
const TITULO_FORA = /palpite|aposta|odds|\bbet\b|progn[oó]stico|cupom|promo[cç][aã]o|achados & perdidos|h[aá] \d+ anos|\bvote\b|enquete|\bquiz\b|veja imagens|melhores momentos|ao vivo/i;
const JORNALISTAS = ["Venê Casagrande", "Pablo Raphael", "Mauro Cezar", "Julio Miguel Neto", "Renan Moura", "Fabrizio Romano", "Bruno Andrade"];

const REGRAS = [
  ["feminino", /feminin|sub-?\d\d|\bbase\b|copinha|juvenil de futebol|garotos do ninho/i],
  ["outros", /basquete|v[oô]lei|nata[cç][aã]o|\bremo\b|jud[oô]|gin[aá]stica|\bnbb\b|polo aqu[aá]tico|futsal|e-?sports|atletismo|beach soccer|liga sul-americana/i],
  ["jogo", / x |escala[cç][aã]o|desfalque|onde assistir|ingresso|rodada|arbitragem|[aá]rbitro|relacionados|pr[eé]-jogo|vence|venceu|empata|perde|derrota|vit[oó]ria|goleia|tabela|classifica[cç][aã]o/i],
  ["mercado", /contrat|refor[cç]o|proposta|interesse|negocia|mercado|sondag|renova|venda|vender|empr[eé]stimo|\balvo|oferta|multa|janela|sa[ií]da de/i],
  ["elenco", /les[aã]o|lesion|treino|treina|volta aos|recupera|convoca|suspens|departamento m[eé]dico|cirurgia|reapresenta|elenco|poupad/i],
];

const limpar = (s) => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const campo = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? limpar(m[1]) : ""; };
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const VAZIAS = new Set("flamengo para pelo pela pelos pelas esta estao apos sobre como mais quer entre deve pode sera seus suas veja entenda diz afirma revela contra ainda desde ate com sem que uma dos das nos nas por jogo clube time".split(" "));
const palavras = (s) => new Set(semAcento(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length > 2 && !VAZIAS.has(p)).map((p) => p.slice(0, 5)));
// Duas manchetes contam como o mesmo fato quando dividem boa parte das palavras importantes.
function parecido(a, b) {
  const A = palavras(a), B = palavras(b);
  if (!A.size || !B.size) return false;
  let comum = 0; for (const p of A) if (B.has(p)) comum++;
  const fatia = comum / Math.min(A.size, B.size);
  return (comum >= 2 && fatia >= 0.4) || (comum >= 3 && fatia >= 0.3);
}
const categoria = (t) => (REGRAS.find(([, re]) => re.test(t)) || ["bastidores"])[0];
const peso = (fonte) => { const i = PREFERIDAS.indexOf(fonte); return i < 0 ? PREFERIDAS.length : i; };
const slug = (t) => semAcento(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/, "");

async function lerFeed(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; leitor-de-rss)" } });
  if (!r.ok) throw new Error(`feed respondeu ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const fonte = campo(it, "source");
    let titulo = campo(it, "title");
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3));
    return { titulo, fonte, url: campo(it, "link"), data: new Date(campo(it, "pubDate")) };
  });
}

const agora = new Date();
let base = { atualizadoEm: null, noticias: [] };
try { base = JSON.parse(await readFile(ARQUIVO, "utf8")); } catch { /* primeira execução */ }

let itens = [], falhas = 0;
for (const f of FEEDS) {
  try { itens.push(...await lerFeed(f)); } catch (e) { falhas++; console.error("Falhou:", e.message); }
}
if (falhas === FEEDS.length) { console.error("Nenhum feed respondeu; noticias.json não foi alterado."); process.exit(1); }

const candidatos = itens
  .filter((n) => n.titulo && /^https:\/\//.test(n.url) && !isNaN(n.data))
  .filter((n) => agora - n.data < JANELA_HORAS * 36e5 && n.data <= agora)
  .filter((n) => /flamengo|meng[aã]o|rubro-negro/i.test(n.titulo))
  .filter((n) => !FONTES_FORA.test(n.fonte) && !TITULO_FORA.test(n.titulo))
  .sort((a, b) => peso(a.fonte) - peso(b.fonte) || b.data - a.data);

const lista = [...base.noticias];
const novas = [];
for (const n of candidatos) {
  if (novas.length >= MAX_NOVAS) break;
  if (lista.some((x) => x.url === n.url || parecido(x.titulo, n.titulo))) continue;
  const jornalista = JORNALISTAS.find((j) => semAcento(n.titulo).includes(semAcento(j)));
  const dia = n.data.toISOString().slice(0, 10);
  let id = `${dia}-${slug(n.titulo)}`;
  while (lista.some((x) => x.id === id)) id += "-2";
  const doc = {
    id, titulo: n.titulo, resumo: "",
    fonte: n.fonte === "Clube de Regatas do Flamengo" ? "Flamengo (site oficial)" : n.fonte,
    ...(jornalista ? { jornalista } : {}),
    url: n.url, categoria: categoria(n.titulo),
    publicadoEm: n.data.toISOString().replace(/\.\d+Z$/, "Z"),
    capturadoEm: agora.toISOString().replace(/\.\d+Z$/, "Z"),
  };
  lista.push(doc); novas.push(doc);
}

const limite = agora - DIAS_GUARDADOS * 864e5;
const guardadas = lista
  .filter((x) => (Date.parse(x.publicadoEm || x.capturadoEm) || agora) >= limite)
  .sort((a, b) => (Date.parse(b.publicadoEm || b.capturadoEm) || 0) - (Date.parse(a.publicadoEm || a.capturadoEm) || 0));

const saida = { atualizadoEm: agora.toISOString().replace(/\.\d+Z$/, "Z"), noticias: guardadas };
await writeFile(ARQUIVO, JSON.stringify(saida, null, 1) + "\n");
console.log(`${novas.length} novas, ${guardadas.length} no total.`);
for (const n of novas) console.log(` + [${n.categoria}] ${n.titulo} (${n.fonte})`);
