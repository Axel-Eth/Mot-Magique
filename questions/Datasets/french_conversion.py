import json
import re
from pathlib import Path

_LANG_KEY_RE = re.compile(r"^[a-z]{2}(-[A-Z]{2})?$")  # fr, en, pt-BR...

def looks_like_lang_map(d: dict) -> bool:
    if not isinstance(d, dict):
        return False
    if "fr" not in d:
        return False

    keys = list(d.keys())
    langish = [k for k in keys if isinstance(k, str) and _LANG_KEY_RE.match(k)]
    # on considère "multilingue" si au moins 2 clés langues,
    # et si la majorité des clés ressemblent à des codes de langue
    return len(langish) >= 2 and len(langish) >= max(2, int(0.8 * len(keys)))

def keep_only_french(node):
    if isinstance(node, dict):
        if looks_like_lang_map(node):
            return {"fr": keep_only_french(node["fr"])}
        return {k: keep_only_french(v) for k, v in node.items()}

    if isinstance(node, list):
        return [keep_only_french(x) for x in node]

    return node

def process_file(in_path: Path, mode: str = "suffix") -> Path:
    """
    mode:
      - "suffix": écrit <nom>_fr.json puis supprime l'original
      - "replace": remplace l'original (écriture atomique via fichier temp)
    """
    with in_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    filtered = keep_only_french(data)

    if mode == "suffix":
        out_path = in_path.with_name(in_path.stem + "_fr" + in_path.suffix)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(filtered, f, ensure_ascii=False, indent=2)
        in_path.unlink()  # supprime l'original
        return out_path

    if mode == "replace":
        tmp_path = in_path.with_suffix(in_path.suffix + ".tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(filtered, f, ensure_ascii=False, indent=2)
        tmp_path.replace(in_path)  # remplace l'original
        return in_path

    raise ValueError("mode must be 'suffix' or 'replace'")

def main():
    here = Path(__file__).resolve().parent
    json_files = sorted(p for p in here.glob("*.json") if not p.name.endswith("_fr.json"))

    if not json_files:
        print("Aucun .json à traiter dans le dossier.")
        return

    mode = "suffix"  # change en "replace" si tu veux écraser les fichiers
    for p in json_files:
        try:
            out = process_file(p, mode=mode)
            print(f"✅ {p.name} -> {out.name} (original supprimé)" if mode == "suffix" else f"✅ {p.name} remplacé")
        except Exception as e:
            print(f"❌ {p.name} : {e}")

if __name__ == "__main__":
    main()
