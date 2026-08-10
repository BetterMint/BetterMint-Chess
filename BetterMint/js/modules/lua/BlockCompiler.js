import { blockDef } from "./BlockDefs.js";

let _uid = 0;
export function newBlockId() {
  return "b" + Date.now().toString(36) + (++_uid).toString(36);
}

export function createBlock(type) {
  const def = blockDef(type);
  const b = { id: newBlockId(), type, x: 24, y: 24, fields: {}, inputs: {}, next: null };
  for (const f of def?.fields || []) b.fields[f.name] = f.def;
  for (const i of def?.inputs || []) b.fields[i.name] = i.def;
  if (def?.kind === "cblock" || def?.kind === "hat") { b.body = []; if (def.hasElse) b.else = []; }
  return b;
}

export function emptyWorkspace() {
  return { blocks: {}, roots: [] };
}

function indent(code, pad) {
  if (!code) return "";
  return code.split("\n").map((l) => (l.trim() ? pad + l : l)).join("\n");
}

export function compileWorkspace(ws) {
  const blocks = ws?.blocks || {};
  const roots = ws?.roots || [];

  const ctxFor = (blk, padLevel) => ({
    field: (name) => blk.fields?.[name],
    input: (name) => compileInput(blk, name),
    body: () => compileStack(blk.body || [], padLevel + 1),
    elseBody: () => compileStack(blk.else || [], padLevel + 1),
  });

  function literal(blk, slot) {
    const def = blockDef(blk.type);
    const spec = (def?.inputs || []).find((i) => i.name === slot);
    const raw = blk.fields?.[slot];
    if (spec?.hint === "number") {
      const n = Number(raw);
      return Number.isFinite(n) ? String(n) : "0";
    }
    if (spec?.hint === "any" && raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))) {
      return String(Number(raw));
    }
    if (spec?.hint === "any" && (raw === "true" || raw === "false")) return raw;
    return JSON.stringify(String(raw ?? ""));
  }

  function compileInput(blk, slot) {
    const childId = blk.inputs?.[slot];
    const child = childId ? blocks[childId] : null;
    const def = child ? blockDef(child.type) : null;
    if (child && def?.kind === "value" && def.expr) {
      return def.expr(ctxFor(child, 0));
    }
    return literal(blk, slot);
  }

  function compileStack(ids, padLevel) {
    const pad = "  ".repeat(padLevel);
    const out = [];
    for (const id of ids) {
      const blk = blocks[id];
      if (!blk) continue;
      const def = blockDef(blk.type);
      if (!def || !def.code) continue;
      const code = def.code(ctxFor(blk, padLevel));
      if (code) out.push(indent(code, pad));
      if (blk.next) out.push(compileStack([blk.next], padLevel));
    }
    return out.filter(Boolean).join("\n");
  }

  const sections = ["-- Built with BetterMint Blocks", "local _v = {}"];
  const loose = [];
  for (const id of roots) {
    const blk = blocks[id];
    if (!blk) continue;
    const def = blockDef(blk.type);
    if (!def) continue;
    if (def.kind === "hat") {
      const code = def.code(ctxFor(blk, 0));
      if (code) sections.push(code);
    } else {
      loose.push(id);
    }
  }
  if (loose.length) {
    const code = compileStack(loose, 0);
    if (code.trim()) sections.push("-- loose blocks (run at start)\n" + code);
  }
  return sections.filter(Boolean).join("\n\n") + "\n";
}

export function validateWorkspace(ws) {
  const blocks = ws?.blocks || {};
  const referenced = new Set();
  for (const blk of Object.values(blocks)) {
    for (const cid of Object.values(blk.inputs || {})) if (cid) referenced.add(cid);
    for (const cid of blk.body || []) referenced.add(cid);
    for (const cid of blk.else || []) referenced.add(cid);
    if (blk.next) referenced.add(blk.next);
  }
  const roots = (ws?.roots || []).filter((id) => blocks[id]);
  for (const id of Object.keys(blocks)) {
    if (!referenced.has(id) && !roots.includes(id)) roots.push(id);
  }
  return { blocks, roots };
}
