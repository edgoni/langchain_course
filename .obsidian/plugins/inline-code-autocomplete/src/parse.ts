// Lógica pura (sin dependencias de Obsidian) para detectar spans de código
// y extraer candidatos de autocompletado de una nota.

export type LineKind = "text" | "code" | "fence" | "front";

export interface Candidate {
	text: string;
	count: number;
	/** "ident": identificador suelto (psi, calcular_energia, np.linalg.eig). "span": fragmento completo de código inline (calcular(psi, h)). */
	kind: "span" | "ident";
}

export interface ExtractOptions {
	/** Además del fragmento completo, indexar los identificadores que contiene. */
	identsFromSpans: boolean;
	/** Indexar identificadores de bloques de código (```...```). */
	includeCodeBlocks: boolean;
}

/** Zona de una línea que se ignora (lo que el usuario está escribiendo ahora mismo). */
export interface BlankRange {
	line: number;
	from: number;
	to: number;
}

const IDENT_SRC = "[\\p{L}_][\\p{L}\\p{N}_]*(?:\\.[\\p{L}_][\\p{L}\\p{N}_]*)*";
const WHOLE_IDENT = new RegExp("^" + IDENT_SRC + "$", "u");

/** Último identificador (con puntos) justo antes del cursor. */
export const TAIL_IDENT = /[\p{L}_][\p{L}\p{N}_.]*$/u;
/** Contenido "simple": solo caracteres de identificador y puntos. */
export const PLAIN_CONTENT = /^[\p{L}\p{N}_.]*$/u;

const MIN_LEN = 2;
const MAX_SPAN_LEN = 80;

// Palabras reservadas / ruido habitual en bloques de código de varios lenguajes.
const STOP = new Set(
	(
		"if else elif for while return def class import from as in is not and or true false null none " +
		"self this const let var function new try except catch finally with pass break continue lambda " +
		"yield await async int float str bool print void public private protected static then do end " +
		"switch case default package interface struct enum extends implements throw throws raise del " +
		"global nonlocal assert fn pub use mod let mut impl match loop where type"
	).split(" "),
);

/**
 * Clasifica cada línea hasta `last` (inclusive): texto normal, dentro de un
 * bloque de código, línea de valla (``` o ~~~) o frontmatter YAML.
 */
export function classifyLines(lines: string[], last: number = lines.length - 1): LineKind[] {
	const kinds: LineKind[] = [];
	let i = 0;

	if (lines.length > 0 && lines[0].trim() === "---") {
		let j = 1;
		while (j < lines.length && lines[j].trim() !== "---" && lines[j].trim() !== "...") j++;
		if (j < lines.length) {
			for (let k = 0; k <= j && k <= last; k++) kinds.push("front");
			i = j + 1;
		}
	}

	let fence: string | null = null;
	for (; i <= last && i < lines.length; i++) {
		const line = lines[i];
		const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
		if (fence === null) {
			if (m) {
				fence = m[1];
				kinds.push("fence");
			} else {
				kinds.push("text");
			}
		} else if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) {
			fence = null;
			kinds.push("fence");
		} else {
			kinds.push("code");
		}
	}
	return kinds;
}

export interface OpenSpan {
	/** Posición del primer backtick de la apertura. */
	runStart: number;
	/** Posición donde empieza el contenido (justo tras los backticks). */
	contentStart: number;
	runLen: number;
}

/**
 * Dado el texto de una línea hasta el cursor, devuelve el span de código
 * inline que sigue abierto en el cursor (o null). Respeta spans con varios
 * backticks (``código con ` dentro``).
 */
export function openSpan(before: string): OpenSpan | null {
	let open: OpenSpan | null = null;
	let i = 0;
	while (i < before.length) {
		if (before[i] === "`") {
			let j = i;
			while (j < before.length && before[j] === "`") j++;
			const len = j - i;
			if (open === null) open = { runStart: i, contentStart: j, runLen: len };
			else if (open.runLen === len) open = null;
			i = j;
		} else {
			i++;
		}
	}
	return open;
}

/** Contenidos de los spans de código inline *cerrados* de una línea. */
export function scanSpans(line: string): string[] {
	const out: string[] = [];
	let open: { len: number; contentStart: number } | null = null;
	let i = 0;
	while (i < line.length) {
		if (line[i] === "`") {
			let j = i;
			while (j < line.length && line[j] === "`") j++;
			const len = j - i;
			if (open === null) open = { len, contentStart: j };
			else if (open.len === len) {
				out.push(line.slice(open.contentStart, i));
				open = null;
			}
			i = j;
		} else {
			i++;
		}
	}
	return out;
}

/** Recorre toda la nota y reúne los candidatos de autocompletado. */
export function extractCandidates(
	lines: string[],
	opts: ExtractOptions,
	blank?: BlankRange,
): Map<string, Candidate> {
	const map = new Map<string, Candidate>();

	const add = (text: string, kind: "span" | "ident") => {
		const c = map.get(text);
		if (c) c.count++;
		else map.set(text, { text, count: 1, kind });
	};
	const addIdent = (id: string) => {
		if (id.length >= MIN_LEN) add(id, "ident");
		if (id.includes(".")) {
			for (const part of id.split(".")) if (part.length >= MIN_LEN) add(part, "ident");
		}
	};

	const kinds = classifyLines(lines);
	for (let i = 0; i < lines.length; i++) {
		const kind = kinds[i];
		if (kind === "front" || kind === "fence") continue;

		let line = lines[i];
		if (blank && blank.line === i) {
			line = line.slice(0, blank.from) + " ".repeat(Math.max(0, blank.to - blank.from)) + line.slice(blank.to);
		}

		if (kind === "code") {
			if (!opts.includeCodeBlocks) continue;
			for (const m of line.matchAll(new RegExp(IDENT_SRC, "gu"))) {
				const id = m[0];
				if (STOP.has(id.toLowerCase())) continue;
				addIdent(id);
			}
			continue;
		}

		for (const raw of scanSpans(line)) {
			const content = raw.trim();
			if (content.length < MIN_LEN || content.length > MAX_SPAN_LEN) continue;
			if (WHOLE_IDENT.test(content)) {
				addIdent(content);
			} else {
				add(content, "span");
				if (opts.identsFromSpans) {
					for (const m of content.matchAll(new RegExp(IDENT_SRC, "gu"))) addIdent(m[0]);
				}
			}
		}
	}
	return map;
}
