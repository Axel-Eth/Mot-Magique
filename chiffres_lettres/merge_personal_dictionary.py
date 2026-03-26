from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
except Exception:  # pragma: no cover
    tk = None
    filedialog = None
    messagebox = None


BASE_DIR = Path(__file__).resolve().parent
LEXICON_SQL_PATH = BASE_DIR / "lexique.sql"
PERSONAL_DICTIONARY_PATH = BASE_DIR / "dictionnaire_perso.json"
SQL_INSERT_RE = re.compile(r"INSERT INTO `lexique` VALUES\('((?:''|[^'])*)'")
USE_GUI_DIALOGS = len(sys.argv) == 1


def normalize_word(value: str) -> str:
    text = str(value or "")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.upper()
    text = re.sub(r"[^A-Z]", "", text)
    return text


def decode_sql_bytes(raw: bytes) -> str:
    candidates: list[tuple[int, str]] = []
    for encoding in ("utf-8", "cp1252"):
        try:
            text = raw.decode(encoding, errors="replace")
        except Exception:
            continue
        score = 0
        if "CREATE TABLE `lexique`" in text:
            score += 50
        if "INSERT INTO `lexique` VALUES" in text:
            score += 50
        score -= text.count("Ã") * 4
        score -= text.count("Â") * 4
        score -= text.count("\ufffd") * 4
        score += min(60, sum(text.count(ch) for ch in "éèêàâîïôùûçœæ"))
        candidates.append((score, text))

    if not candidates:
        return raw.decode("utf-8", errors="replace")

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def load_base_lexicon_words(path: Path) -> set[str]:
    if not path.exists():
        return set()

    raw = path.read_bytes()
    text = decode_sql_bytes(raw)
    words: set[str] = set()
    for match in SQL_INSERT_RE.finditer(text):
        raw_word = match.group(1).replace("''", "'")
        word = normalize_word(raw_word)
        if 2 <= len(word) <= 10:
            words.add(word)
    return words


def extract_words(payload) -> list[str]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("words"), list):
        return payload["words"]
    return []


def normalize_words(words: list[str]) -> set[str]:
    normalized: set[str] = set()
    for word in words:
        clean = normalize_word(word)
        if 2 <= len(clean) <= 10:
            normalized.add(clean)
    return normalized


def load_json_words(path: Path) -> set[str]:
    if not path.exists():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    return normalize_words(extract_words(payload))


def save_personal_dictionary(path: Path, words: set[str]) -> None:
    payload = {
        "words": sorted(words)
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pick_import_file() -> Path | None:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).expanduser().resolve()

    if filedialog is None or tk is None:
        return None

    root = tk.Tk()
    root.withdraw()
    root.update()
    selected = filedialog.askopenfilename(
        title="Choisir un export de dictionnaire personnel",
        filetypes=[("Fichiers JSON", "*.json"), ("Tous les fichiers", "*.*")]
    )
    root.destroy()
    if not selected:
        return None
    return Path(selected).expanduser().resolve()


def show_message(title: str, message: str, *, error: bool = False) -> None:
    if USE_GUI_DIALOGS and messagebox is not None and tk is not None:
        root = tk.Tk()
        root.withdraw()
        root.update()
        if error:
            messagebox.showerror(title, message)
        else:
            messagebox.showinfo(title, message)
        root.destroy()
        return

    stream = sys.stderr if error else sys.stdout
    print(f"{title}\n{message}", file=stream)


def merge_dictionary(import_path: Path) -> str:
    if not import_path.exists():
        raise FileNotFoundError(f"Fichier introuvable: {import_path}")

    imported_words = load_json_words(import_path)
    if not imported_words:
        raise ValueError("Le fichier ne contient aucun mot valide.")

    existing_personal_words = load_json_words(PERSONAL_DICTIONARY_PATH)
    base_lexicon_words = load_base_lexicon_words(LEXICON_SQL_PATH)

    new_words = imported_words - existing_personal_words - base_lexicon_words
    merged_words = existing_personal_words | new_words
    save_personal_dictionary(PERSONAL_DICTIONARY_PATH, merged_words)

    skipped_already_personal = len(imported_words & existing_personal_words)
    skipped_already_sql = len(imported_words & base_lexicon_words)

    return (
        f"Import termine.\n\n"
        f"Fichier importe: {import_path.name}\n"
        f"Nouveaux mots ajoutes: {len(new_words)}\n"
        f"Deja presents dans dictionnaire_perso.json: {skipped_already_personal}\n"
        f"Deja presents dans lexique.sql: {skipped_already_sql}\n"
        f"Total dictionnaire perso projet: {len(merged_words)}\n\n"
        f"Fichier mis a jour:\n{PERSONAL_DICTIONARY_PATH}"
    )


def main() -> int:
    try:
        import_path = pick_import_file()
        if import_path is None:
            show_message("Import annule", "Aucun fichier selectionne.")
            return 0

        summary = merge_dictionary(import_path)
        show_message("Dictionnaire perso", summary)
        return 0
    except Exception as err:
        show_message("Erreur import dictionnaire", str(err), error=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
