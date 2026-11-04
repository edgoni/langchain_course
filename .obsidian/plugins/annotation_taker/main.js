var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MasterQuickNotes
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var HEADER = "> [!master]- Mi Aportaci\xF3n";
var HEADER_RE = /^>\s*\[!master\]/i;
var ANY_CALLOUT_RE = /^>\s*\[!/;
var MasterQuickNotes = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "toggle-master-note",
      name: "Toggle / Insert Master Note",
      editorCallback: (editor) => this.toggle(editor)
    });
  }
  toggle(editor) {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const block = this.findBlock(editor, from.line);
    if (block) return this.unwrap(editor, block.start, block.end);
    if (editor.somethingSelected()) this.wrap(editor, from, to);
    else this.insertEmpty(editor, from.line);
  }
  /** Localiza el callout [!master] que contiene la línea dada. */
  findBlock(editor, line) {
    if (!editor.getLine(line).startsWith(">")) return null;
    let start = -1;
    for (let i = line; i >= 0 && editor.getLine(i).startsWith(">"); i--) {
      if (HEADER_RE.test(editor.getLine(i))) {
        start = i;
        break;
      }
      if (ANY_CALLOUT_RE.test(editor.getLine(i))) return null;
    }
    if (start < 0) return null;
    let end = start;
    const last = editor.lastLine();
    while (end < last) {
      const next = editor.getLine(end + 1);
      if (!next.startsWith(">") || ANY_CALLOUT_RE.test(next)) break;
      end++;
    }
    return { start, end };
  }
  unwrap(editor, start, end) {
    const body = [];
    for (let i = start + 1; i <= end; i++) {
      body.push(editor.getLine(i).replace(/^>\s?/, ""));
    }
    editor.replaceRange(
      body.join("\n"),
      { line: start, ch: 0 },
      { line: end, ch: editor.getLine(end).length }
    );
    editor.setCursor({ line: start, ch: 0 });
  }
  wrap(editor, from, to) {
    const endLine = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;
    const lines = [];
    for (let i = from.line; i <= endLine; i++) lines.push(editor.getLine(i));
    const body = lines.map((l) => l.trim() ? `> ${l}` : ">");
    const before = from.line > 0 && editor.getLine(from.line - 1).trim() ? "\n" : "";
    const after = endLine < editor.lastLine() && editor.getLine(endLine + 1).trim() ? "\n" : "";
    editor.replaceRange(
      before + [HEADER, ...body].join("\n") + after,
      { line: from.line, ch: 0 },
      { line: endLine, ch: editor.getLine(endLine).length }
    );
    const lastBodyLine = from.line + (before ? 1 : 0) + body.length;
    editor.setCursor({ line: lastBodyLine, ch: body[body.length - 1].length });
  }
  insertEmpty(editor, line) {
    const current = editor.getLine(line);
    const isEmpty = current.trim() === "";
    const needsGap = line < editor.lastLine() && editor.getLine(line + 1).trim() !== "";
    const text = (isEmpty ? "" : "\n\n") + HEADER + "\n> " + (needsGap ? "\n" : "");
    editor.replaceRange(
      text,
      { line, ch: isEmpty ? 0 : current.length },
      { line, ch: current.length }
    );
    editor.setCursor({ line: line + (isEmpty ? 0 : 2) + 1, ch: 2 });
  }
};
