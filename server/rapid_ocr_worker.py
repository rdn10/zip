"""Persistent local RapidOCR worker; communicates with Node over JSON lines."""
import json
import os
import re
import sys
import unicodedata

threads = max(1, int(os.environ.get("RAPIDOCR_CPU_THREADS", "2")))
for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "ORT_INTRA_OP_NUM_THREADS"):
    os.environ[name] = str(threads)

try:
    import fitz
    import numpy as np
    from rapidocr import RapidOCR

    try:
        if hasattr(os, "nice"):
            os.nice(5)
        elif hasattr(os, "process_priority"):
            os.process_priority = "below_normal"
    except Exception:
        pass

    print("[RapidOCR] Inicializando modelos ONNX CPU.", file=sys.stderr, flush=True)
    engine = RapidOCR(params={"Rec.lang_type": "pt"})
    print(json.dumps({"ready": True}), flush=True)
except Exception as exc:
    print(json.dumps({"startupError": str(exc)}), flush=True)
    sys.exit(1)


def recognize(image):
    result = engine(image)
    boxes = getattr(result, "boxes", None)
    texts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    boxes = [] if boxes is None else boxes
    texts = [] if texts is None else texts
    scores = [] if scores is None else scores
    items = []
    for index, text in enumerate(texts):
        if not text:
            continue
        points = np.asarray(boxes[index], dtype=float).reshape(-1, 2)
        width = float(points[:, 0].max() - points[:, 0].min())
        height = float(points[:, 1].max() - points[:, 1].min())
        x = float((points[:, 0].min() + points[:, 0].max()) / 2)
        y = float((points[:, 1].min() + points[:, 1].max()) / 2)
        items.append({"text": str(text).strip(), "x": x, "y": y,
                      "score": float(scores[index]) if index < len(scores) else 0.0,
                      "vertical": height > max(width * 1.15, 1.0)})
    items.sort(key=lambda item: item["y"])
    rows = []
    for item in items:
        if not rows or abs(item["y"] - rows[-1]["y"]) > 18:
            rows.append({"y": item["y"], "cells": []})
        rows[-1]["cells"].append(item)
        rows[-1]["y"] = sum(cell["y"] for cell in rows[-1]["cells"]) / len(rows[-1]["cells"])
    output_rows = []
    for row in rows:
        cells = sorted(row["cells"], key=lambda item: item["x"])
        output_rows.append({"y": row["y"], "cells": [{"text": cell["text"], "x": cell["x"], "score": cell["score"]} for cell in cells]})
    markdown = "\n".join("| " + " | ".join(cell["text"] for cell in sorted(row["cells"], key=lambda item: item["x"])) + " |" for row in rows)
    return {"markdown": markdown, "rows": output_rows, "items": items}


def recognize_page(image):
    """Trim large blank scan margins before OCR, preserving page coordinates."""
    height, width = image.shape[:2]
    gray = image[:, :, :3].mean(axis=2)
    ink = gray < 238
    x0, x1 = int(width * 0.02), int(width * 0.98)
    y0, y1 = int(height * 0.02), int(height * 0.98)
    column_counts = ink[y0:y1, x0:x1].sum(axis=0)
    row_counts = ink[y0:y1, x0:x1].sum(axis=1)
    active_columns = np.flatnonzero(column_counts >= max(8, int((y1 - y0) * 0.004)))
    active_rows = np.flatnonzero(row_counts >= max(8, int((x1 - x0) * 0.004)))
    if len(active_columns) < 2 or len(active_rows) < 2:
        return recognize(image)

    left = x0 + int(active_columns[0])
    right = x0 + int(active_columns[-1]) + 1
    top = y0 + int(active_rows[0])
    bottom = y0 + int(active_rows[-1]) + 1
    pad_x = max(12, int((right - left) * 0.025))
    pad_y = max(12, int((bottom - top) * 0.02))
    left, right = max(0, left - pad_x), min(width, right + pad_x)
    top, bottom = max(0, top - pad_y), min(height, bottom + pad_y)

    # Avoid needless crops for normally framed documents.
    if (right - left) >= width * 0.94 and (bottom - top) >= height * 0.94:
        return recognize(image)
    result = recognize(image[top:bottom, left:right])
    for item in result["items"]:
        item["x"] += left
        item["y"] += top
    for row in result["rows"]:
        row["y"] += top
        for cell in row["cells"]:
            cell["x"] += left
    print(f"[RapidOCR] Margens vazias removidas antes do OCR ({width}x{height} -> {right-left}x{bottom-top}).", file=sys.stderr, flush=True)
    return result


def normalize_text(value):
    value = unicodedata.normalize("NFD", str(value).upper())
    return "".join(char for char in value if unicodedata.category(char) != "Mn")


def orientation_score(result, context=None):
    texts = [item["text"].upper() for item in result["items"]]
    keywords = ("ORIGEM", "DESTINO", "FRETE", "PED", "TOTAL", "BITREM", "TOCO", "TRUCK", "CARRETA", "VUC", "MOTORISTA")
    anchors = sum(any(word in text for word in keywords) for text in texts)
    vertical = sum(1 for item in result["items"] if item["vertical"])
    confidence = sum(item["score"] for item in result["items"])
    # Filename route and registered city/code names help choose the readable
    # rotation, just as they are used later by the shared Paddle/Rapid parser.
    normalized_page = normalize_text(" ".join(texts))
    context = context or {}
    route_hints = [context.get("originHint"), context.get("destinationHint")]
    route_hints += [context.get("filename", "")]
    route_matches = sum(
        1 for hint in route_hints if hint and len(normalize_text(hint)) >= 4
        and normalize_text(hint) in normalized_page
    )
    route_labels = sum(label in normalized_page for label in ("ORIGEM", "DESTINO"))
    candidates = context.get("cityCandidates", [])
    code_matches = sum(
        1 for city in candidates for code in city.get("codes", [])
        if len(normalize_text(code)) >= 4 and normalize_text(code) in normalized_page
    )
    return (anchors * 5 + confidence - vertical * 3 + route_labels * 12
            + route_matches * 15 + min(code_matches, 2) * 2
            + tariff_value_count(result) * 8)


def tariff_value_count(result):
    def normalize_text(value):
        return "".join(char for char in unicodedata.normalize("NFD", value.upper())
                       if unicodedata.category(char) != "Mn")

    items = result.get("items", [])
    headers = [item for item in items if "TOTAL" in normalize_text(item["text"])]
    if not headers:
        return 0
    header = max(headers, key=lambda item: item["y"])
    profile_pattern = re.compile(r"BITREM|CARRETA|TRUCK|TOCO|MEDIO|VUC")
    labels = [item for item in items
              if item["y"] > header["y"] and item["x"] < header["x"] * 0.7
              and profile_pattern.search(normalize_text(item["text"]))]
    if not labels:
        return 0
    gaps = sorted(b["y"] - a["y"] for a, b in zip(sorted(labels, key=lambda item: item["y"]),
                                                    sorted(labels, key=lambda item: item["y"])[1:])
                  if 0 < b["y"] - a["y"] < 80)
    tolerance = (gaps[len(gaps) // 2] * 0.55) if gaps else 18
    numeric_items = []
    for item in items:
        if item["x"] < header["x"] * 0.82:
            continue
        text = normalize_text(item["text"]).replace("O", "0").replace("S", "5")
        values = re.findall(r"\d+(?:[.,]\d+)*", text)
        # Count plausible tariff amounts, not stray marks such as "S", "008"
        # or "0099". Those were making incomplete reads look complete and
        # prevented the higher-resolution recovery pass from running.
        for raw in values:
            compact = raw.replace(".", "").replace(",", "")
            try:
                amount = int(compact)
            except ValueError:
                continue
            if 100 <= amount <= 100_000:
                numeric_items.append(item)
                break
    return sum(any(abs(value["y"] - label["y"]) <= tolerance for value in numeric_items)
               for label in labels)


for line in sys.stdin:
    try:
        request = json.loads(line)
        document = fitz.open(request["path"])
        pages = []
        for page_index, page in enumerate(document):
            context = request.get("context", {})
            # Never infer orientation from a single first pass. Evaluate the
            # four absolute directions for every page and keep the strongest
            # OCR result, including on PDFs with a preexisting /Rotate value.
            candidates = []
            for rotation in (0, 90, 180, 270):
                rotated_page = fitz.open()
                rotated_page.insert_pdf(document, from_page=page_index, to_page=page_index)
                rotated = rotated_page[0]
                rotated.set_rotation(rotation)
                rotated_pix = rotated.get_pixmap(matrix=fitz.Matrix(1.65, 1.65), alpha=False)
                rotated_image = np.frombuffer(rotated_pix.samples, dtype=np.uint8).reshape(rotated_pix.height, rotated_pix.width, rotated_pix.n)
                candidate = recognize_page(rotated_image[:, :, :3] if rotated_pix.n == 4 else rotated_image)
                candidates.append({**candidate, "rotation": rotation})
                rotated_page.close()
            current = max(candidates, key=lambda candidate: orientation_score(candidate, context))
            selected_rotation = current["rotation"]
            if selected_rotation != page.rotation:
                print(f"[RapidOCR] Orientação selecionada: {selected_rotation} graus.", file=sys.stderr, flush=True)
            alternate_items = []
            base_tariff_count = tariff_value_count(current)
            if base_tariff_count < 8:
                # A focused higher-resolution pass is only used when the first
                # read misses several total cells, keeping normal pages fast.
                detail_page = fitz.open()
                detail_page.insert_pdf(document, from_page=page_index, to_page=page_index)
                detail_page[0].set_rotation(selected_rotation)
                detail_pix = detail_page[0].get_pixmap(matrix=fitz.Matrix(3.0, 3.0), alpha=False)
                detail_image = np.frombuffer(detail_pix.samples, dtype=np.uint8).reshape(detail_pix.height, detail_pix.width, detail_pix.n)
                if detail_pix.n == 4:
                    detail_image = detail_image[:, :, :3]
                detail_result = recognize_page(detail_image)
                detail_page.close()
                detail_tariff_count = tariff_value_count(detail_result)
                if detail_tariff_count > base_tariff_count:
                    scale_back = 1.65 / 3.0
                    alternate_items = [
                        {"text": item["text"], "x": item["x"] * scale_back,
                         "y": item["y"] * scale_back, "score": item["score"]}
                        for item in detail_result["items"]
                    ]
                    print(f"[RapidOCR] Passagem em alta resolução recuperou células de tarifa ({base_tariff_count} -> {detail_tariff_count}).", file=sys.stderr, flush=True)
            pages.append({"page": page_index + 1, "rotation": selected_rotation,
                          "alternateItems": alternate_items, **current})
        document.close()
        print(json.dumps({"id": request["id"], "result": {"pages": pages}}), flush=True)
    except Exception as exc:
        print(json.dumps({"id": request.get("id"), "error": str(exc)}), flush=True)
