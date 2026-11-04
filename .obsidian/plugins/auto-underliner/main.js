const { Plugin, Notice, MarkdownView } = require("obsidian");

module.exports = class AutoHighlighterPlugin extends Plugin {
  async onload() {
    this.active = false;

    // Indicador en la barra de estado
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("auto-highlighter-status");
    this.updateStatus();

    // Ctrl+S (Cmd+S en Mac) para activar/desactivar
    this.addCommand({
      id: "toggle-auto-highlight",
      name: "Activar/desactivar modo subrayado automático",
      hotkeys: [{ modifiers: ["Mod"], key: "s" }],
      callback: () => this.toggle(),
    });

    // Ratón: al soltar el botón se procesa la selección
    this.registerDomEvent(document, "mouseup", (evt) => {
      if (!this.active) return;
      if (!(evt.target instanceof HTMLElement)) return;
      if (!evt.target.closest(".cm-editor")) return;
      setTimeout(() => this.highlightSelection(), 10);
    });

    // Teclado: al soltar Shift tras seleccionar con flechas
    this.registerDomEvent(document, "keyup", (evt) => {
      if (!this.active) return;
      if (evt.key !== "Shift") return;
      setTimeout(() => this.highlightSelection(), 10);
    });
  }

  onunload() {
    this.active = false;
  }

  toggle() {
    this.active = !this.active;
    this.updateStatus();
    new Notice(
      this.active
        ? "🖍️ Modo subrayado ACTIVADO"
        : "Modo subrayado desactivado"
    );
  }

  updateStatus() {
    this.statusEl.setText(this.active ? "🖍️ Subrayando" : "");
    this.statusEl.toggleClass("is-active", this.active);
    this.statusEl.style.display = this.active ? "" : "none";
  }

  highlightSelection() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const editor = view.editor;
    if (!editor || !editor.somethingSelected()) return;

    const sel = editor.listSelections()[0];
    let from = sel.anchor;
    let to = sel.head;
    if (from.line > to.line || (from.line === to.line && from.ch > to.ch)) {
      [from, to] = [to, from];
    }

    const text = editor.getRange(from, to);
    if (!text.trim()) return;

    // ¿Ya estaba subrayado? -> quitar el subrayado
    const before = editor.getRange(
      { line: from.line, ch: Math.max(0, from.ch - 2) },
      from
    );
    const afterLine = editor.getLine(to.line);
    const after = afterLine.substring(to.ch, to.ch + 2);

    let newText;
    let start = from;
    let end = to;

    if (before === "==" && after === "==") {
      // Selección dentro de un subrayado existente: se elimina
      start = { line: from.line, ch: from.ch - 2 };
      end = { line: to.line, ch: to.ch + 2 };
      newText = text;
    } else if (/^==[\s\S]*==$/.test(text) && text.length > 4) {
      // La selección incluye los ==: se eliminan
      newText = text.slice(2, -2);
    } else {
      // Subrayar cada línea no vacía por separado
      newText = text
        .split("\n")
        .map((line) => {
          if (!line.trim()) return line;
          const m = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
          return `${m[1]}==${m[2]}==${m[3]}`;
        })
        .join("\n");
    }

    editor.replaceRange(newText, start, end);

    // Colapsar el cursor al final para no volver a procesar la selección
    const lines = newText.split("\n");
    const endPos = {
      line: start.line + lines.length - 1,
      ch:
        lines.length === 1
          ? start.ch + newText.length
          : lines[lines.length - 1].length,
    };
    editor.setCursor(endPos);
  }
};
