/**
 * Minimal RFC 4180 field splitter.
 *
 * Both sanctions sources this phase added are CSV with quoted fields containing
 * commas and, in OFAC's case, embedded quotes — so `line.split(",")` silently
 * mis-parses thousands of rows. This is small enough not to justify a dependency
 * and is the only reason a parser exists here.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

/** Header row mapped to column indices. */
export function csvIndex(header: string): Record<string, number> {
  const out: Record<string, number> = {};
  splitCsvLine(header).forEach((name, i) => {
    out[name.trim().replace(/^"|"$/g, "")] = i;
  });
  return out;
}
