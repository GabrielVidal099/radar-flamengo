// Arquivos de calendário (.ics) dos jogos. Usado pelo robô (calendario.ics) e pelo app (botão em cada jogo).
const pad = (n) => String(n).padStart(2, "0");
const utc = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
const esc = (s) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// linhas com mais de 75 caracteres são quebradas, como manda o formato
const dobrar = (l) => { if (l.length <= 74) return l; let o = l.slice(0, 74), r = l.slice(74); while (r.length) { o += "\r\n " + r.slice(0, 73); r = r.slice(73); } return o; };

export function eventoIcs(j, nomeDe, agora) {
  const ini = new Date(j.data), fim = new Date(ini.getTime() + 2 * 3600 * 1000);
  const titulo = nomeDe(j.casa) + " x " + nomeDe(j.fora);
  return [
    "BEGIN:VEVENT", "UID:" + j.id + "@radar-flamengo", "DTSTAMP:" + utc(agora || new Date()), "DTSTART:" + utc(ini), "DTEND:" + utc(fim),
    "SUMMARY:" + esc(titulo), "LOCATION:" + esc([j.estadio, j.cidade].filter(Boolean).join(", ")),
    "DESCRIPTION:" + esc(j.competicao + (j.fase ? " - " + j.fase : "")),
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:" + esc(titulo + " daqui a 1 hora"), "END:VALARM", "END:VEVENT",
  ].map(dobrar).join("\r\n");
}

export function calendarioIcs(jogos, nomeDe, agora) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radar do Flamengo//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Jogos do Flamengo", "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"]
    .concat(jogos.map((j) => eventoIcs(j, nomeDe, agora))).concat(["END:VCALENDAR"]).join("\r\n") + "\r\n";
}
