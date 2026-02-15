import { $ } from "./dom.js";
import { CUSTOM_STORAGE_KEY, state } from "./state.js";

export function loadCustomGridList() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function normalizeGridHref(raw, dir) {
  let href = String(raw || "");
  if (!href) return "";
  href = href.replace(/[#?].*$/, "");
  href = href.replace(/^\.\//, "");
  if (/^https?:\/\//i.test(href)) return "";
  href = href.replace(/^\/?grids\//i, "");
  if (dir && !href.startsWith(dir)) {
    href = `${dir}${href}`;
  }
  return href;
}

function groupFromRelPath(relPath) {
  const parts = String(relPath || "").split("/").filter(Boolean);
  if (parts.length <= 1) return "Racine";
  return parts.slice(0, -1).join(" / ");
}

export async function loadGridList() {
  const entries = [];

  try {
    const base = "grids/";
    const queue = [""];
    const seen = new Set();

    while (queue.length) {
      const dir = queue.shift();
      if (seen.has(dir)) continue;
      seen.add(dir);

      const res = await fetch(`${base}${dir}`, { cache: "no-store" });
      if (!res.ok) continue;
      const html = await res.text();
      const links = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);

      for (const raw of links) {
        const decoded = decodeURIComponent(raw || "");
        if (!decoded || decoded == "../") continue;
        const rel = normalizeGridHref(decoded, dir);
        if (!rel) continue;

        if (rel.endsWith("/")) {
          queue.push(rel);
          continue;
        }

        if (/\.(xlsx|json)$/i.test(rel)) {
          const file = `${base}${rel}`;
          const baseName = rel.split("/").pop() || rel;
          const name = baseName.replace(/\.(xlsx|json)$/i, "");
          const group = groupFromRelPath(rel);
          entries.push({ file, name, group });
        }
      }
    }
  } catch (err) {
    console.warn("Listing /grids/ impossible:", err);
  }

  if (!entries.length) {
    try {
      const resJson = await fetch("grids.json", { cache: "no-store" });
      if (resJson.ok) {
        const listJson = await resJson.json();
        if (Array.isArray(listJson)) {
          listJson.forEach((g) => {
            if (!g?.file) return;
            const base = (g.name && g.name.trim()) || (g.file.split("/").pop() || g.file);
            const name = base.replace(/\.(xlsx|json)$/i, "");
            const rel = g.file.replace(/^\/?grids\//i, "");
            const group = groupFromRelPath(rel);
            entries.push({ file: g.file, name, group });
          });
        }
      }
    } catch (err) {
      console.warn("Fallback grids.json impossible:", err);
    }
  }

  if (!entries.length) {
    throw new Error(
      "Aucune grille trouvee (listing /grids/ indisponible et grids.json absent). Place tes fichiers .xlsx/.json dans /grids/ ou reactive un listing/grids.json."
    );
  }

  const dedup = new Map();
  for (const e of entries) {
    if (!dedup.has(e.file)) dedup.set(e.file, e);
  }
  const list = [...dedup.values()];

  state.gridList = list.sort((a, b) => {
    const ga = a.group || "";
    const gb = b.group || "";
    const g = ga.localeCompare(gb, "fr", { sensitivity: "base" });
    if (g != 0) return g;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
  rebuildGridSelect();
}

export function rebuildGridSelect() {
  const sel = $("gridSelect");
  const prev = sel.value;
  sel.innerHTML = "";

  let currentGroup = "";
  let currentOptgroup = null;
  for (const g of state.gridList) {
    if (!g || !g.name || !g.file) continue;
    const group = g.group || "Racine";
    if (group != currentGroup) {
      currentGroup = group;
      currentOptgroup = document.createElement("optgroup");
      currentOptgroup.label = currentGroup;
      sel.appendChild(currentOptgroup);
    }
    const opt = document.createElement("option");
    opt.value = g.file;
    opt.textContent = g.name;
    currentOptgroup.appendChild(opt);
  }

  const custom = loadCustomGridList();
  if (custom.length) {
    const groupLabel = document.createElement("option");
    groupLabel.disabled = true;
    groupLabel.className = "group-label";
    groupLabel.textContent = "Locales";
    sel.appendChild(groupLabel);
    for (const g of custom) {
      const opt = document.createElement("option");
      opt.value = `custom:${g.id}`;
      opt.textContent = g.name || g.id;
      sel.appendChild(opt);
    }
  }

  if (!sel.options.length) {
    throw new Error("Aucune grille valide (dossier grids/ ou grilles locales).");
  }

  if (prev && sel.querySelector(`option[value=\"${prev}\"]`)) {
    sel.value = prev;
  }
}
