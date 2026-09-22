#!/usr/bin/env python3
"""
QA for generated decks: does the deck talk about the material it was given?

Calls the running app's /api/generate exactly as the browser does, streams
the slides back and scores them:

  slides      how many arrived vs how many were asked for, and whether the
              model hit max_tokens (the route reports `truncated`)
  drift       mentions of the tool's own world (Giga, UNICEF, ITU, school
              connectivity, 2.2M, giga.global) outside the closing slide
  coverage    share of the source's top content terms that appear in the deck
  closing     what the thank-you slide says (contacts, channels)

Conditions worth running on one PDF: as-is, and with `--as-text`, which sends
the PDF's extracted text instead of the file (what the app does when the file
is too big to travel whole). Together they tell the attachment path from the
prompt path apart.

    python3 tools/qa-generate.py --pdf ~/Downloads/study.pdf \
        --brief "generate me a 20-page slide deck" --brand "UNICEF Digital Inclusion" --runs 2

Needs the dev server (`npx next dev -p 3777`) and PyMuPDF (`pip install pymupdf`).
Each run is a real model call and costs about a cent.
"""
import argparse
import base64
import json
import re
import ssl
import sys
import urllib.request
from collections import Counter
from pathlib import Path

DRIFT = re.compile(r"\b(giga|unicef|itu|school connectivit\w*|2\.2M\+?|giga\.global)\b", re.I)
MAX_REQUEST_BYTES = 4 * 1024 * 1024
MAX_TEXT_PER_FILE = 60_000
STOP = set(
    """a about above after again against all am an and any are as at be because been before being below
    between both but by can could did do does doing down during each few for from further had has have having he
    her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not
    now of off on once only or other our ours ourselves out over own same she should so some such than that the
    their theirs them themselves then there these they this those through to too under until up very was we were
    what when where which while who whom why will with would you your yours yourself yourselves also may might must
    shall one two three four five six seven eight nine ten per et al eu european union parliament study report
    table figure page pages section chapter annex source sources based including however therefore thus whether
    within without new use used using data policy policies research level levels high low across""".split()
)


def pdf_text(path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    return "\n".join(page.get_text() for page in doc)


def top_terms(text: str, n: int = 40) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]{3,}", text.lower())
    counts = Counter(w for w in words if w not in STOP)
    return [w for w, _ in counts.most_common(n)]


def strings_of(obj) -> list[str]:
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in strings_of(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in strings_of(v)]
    return []


def build_attachment(path: Path, as_text: bool) -> dict:
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode()
    if as_text or len(b64) > MAX_REQUEST_BYTES:
        text = pdf_text(path)
        kept = text[:MAX_TEXT_PER_FILE]
        return {"id": "qa000001", "name": path.name, "kind": "text", "text": kept, "bytes": len(kept), "truncated": len(text) > len(kept)}
    return {"id": "qa000001", "name": path.name, "kind": "pdf", "mediaType": "application/pdf", "data": b64, "bytes": len(raw)}


def generate(url: str, body: dict) -> tuple[list[dict], dict]:
    req = urllib.request.Request(
        f"{url}/api/generate", data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST"
    )
    slides, done = [], {}
    # A python.org build has no CA bundle of its own: use certifi when present.
    try:
        import certifi

        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=300, context=ctx) as res:
            for line in res:
                line = line.decode().strip()
                if not line:
                    continue
                ev = json.loads(line)
                if ev.get("type") == "slide":
                    slides.append(ev["slide"])
                elif ev.get("type") == "done":
                    done = ev
                elif ev.get("type") == "error":
                    print(f"  route error: {ev.get('message')}")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
    return slides, done


def score(slides: list[dict], terms: list[str], count: int | None, done: dict, brief: str = "") -> bool:
    print(f"  slides: {len(slides)}" + (f" of {count} asked" if count else "") + (" TRUNCATED" if done.get("truncated") else ""))
    usage = done.get("usage") or {}
    if usage:
        cost = (usage.get("inputTokens", 0) * 1 + usage.get("outputTokens", 0) * 5) / 1_000_000
        print(f"  tokens: {usage.get('inputTokens', 0):,} in / {usage.get('outputTokens', 0):,} out  (${cost:.3f})")
    drift_total = 0
    for i, s in enumerate(slides):
        text = " ".join(strings_of(s))
        hits = DRIFT.findall(text)
        closing = s.get("layoutId") == "thank-you"
        if not closing:
            drift_total += len(hits)
        flag = f"  drift={len(hits)} {sorted(set(h.lower() for h in hits))}" if hits else ""
        title = (s.get("title") or s.get("stat") or s.get("quote") or "")[:60]
        print(f"  {i + 1:2} {s.get('layoutId', '?'):18} {title!r}{flag}")
    deck_text = " ".join(" ".join(strings_of(s)) for s in slides).lower()
    covered = [t for t in terms if t in deck_text] if terms else []
    coverage = len(covered) / len(terms) if terms else None
    if terms:
        print(f"  coverage: {len(covered)}/{len(terms)} source terms  {covered[:12]}")
    closing = next((s for s in slides if s.get("layoutId") == "thank-you"), None)
    if closing:
        # channels are seeded client-side (normalizeSlide), so the route never sends them
        print(f"  closing: contacts={closing.get('contacts')}")
    # A brief about Giga or UNICEF is allowed to say so: drift only counts when
    # the brief never mentions them (the closing slide is exempt either way).
    drift_allowed = bool(DRIFT.search(brief))
    ok = (drift_allowed or drift_total == 0) and (coverage is None or coverage >= 0.25) and not done.get("truncated")
    if count:
        ok = ok and len(slides) == count
    print(f"  verdict: {'PASS' if ok else 'FAIL'}  (drift outside closing = {drift_total}{' (allowed: the brief names them)' if drift_allowed else ''}"
          + (f", coverage = {coverage:.0%}" if coverage is not None else "") + ")")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="append", type=Path, default=[])
    ap.add_argument("--brief", required=True)
    ap.add_argument("--brand", default="UNICEF Digital Inclusion")
    ap.add_argument("--count", type=int)
    ap.add_argument("--url", default="http://localhost:3777")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--as-text", action="store_true", help="send the PDF's text instead of the file")
    args = ap.parse_args()

    attachments = [build_attachment(p, args.as_text) for p in args.pdf]
    terms: list[str] = []
    for p in args.pdf:
        terms += top_terms(pdf_text(p))
    terms = list(dict.fromkeys(terms))[:40]
    for a in attachments:
        print(f"attachment: {a['name']} as {a['kind']} ({a['bytes']:,} {'chars' if a['kind'] == 'text' else 'bytes'})")
    if terms:
        print(f"source terms: {terms[:15]} …")

    body = {"mode": "generate", "brief": args.brief, "attachments": attachments, "brandLabel": args.brand,
            "chapters": False, "format": "slides"}
    if args.count:
        body["count"] = args.count
    passed = 0
    for run in range(1, args.runs + 1):
        print(f"\nrun {run}/{args.runs}: brief={args.brief!r} brand={args.brand!r}")
        slides, done = generate(args.url, body)
        passed += score(slides, terms, args.count, done, args.brief)
    print(f"\n{passed}/{args.runs} runs passed")
    return 0 if passed == args.runs else 1


if __name__ == "__main__":
    sys.exit(main())
