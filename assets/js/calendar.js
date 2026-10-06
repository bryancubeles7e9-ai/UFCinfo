import { translate } from "./i18n.js";
export function eventCalendar(event, now = new Date()) {
  const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const clean = (value) => String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const official = event.type === "official";
  const description = official
    ? `Cartelera principal UFC. ${event.subtitle || ""}. El horario y los combates anunciados pueden cambiar. Fuente: ${event.source}`
    : "Evento ficticio creado en UFCinfo. No es una cartelera oficial UFC.";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UFCinfo//Events//ES", "BEGIN:VEVENT",
    `UID:${clean(event.id)}@octagon.local`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.date)}`,
    ...(!official ? [`DTEND:${stamp(Date.parse(event.date) + 10800000)}`] : []),
    `SUMMARY:${clean(event.title)}${official ? "" : translate(" (cartelera imaginaria)")}`,
    `LOCATION:${clean(event.location)}`, `DESCRIPTION:${clean(translate(description))}`,
    ...(official ? [`URL:${clean(event.source)}`] : []), "END:VEVENT", "END:VCALENDAR",
  ];
  // Fold UTF-8 content lines at 75 octets as required by iCalendar.
  const encoder = new TextEncoder();
  const fold = (line) => {
    let result = "", chunk = "", size = 0;
    for (const character of line) {
      const bytes = encoder.encode(character).length;
      if (size + bytes > 75) { result += chunk + "\r\n"; chunk = " "; size = 1; }
      chunk += character; size += bytes;
    }
    return result + chunk;
  };
  return lines.map(fold).join("\r\n") + "\r\n";
}
