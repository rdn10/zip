"""Run the free local PaddleOCR text-recognition pipeline on freight PDFs."""

import json
import os
import sys
import time


def _limit_worker_priority() -> None:
    """Keep OCR below foreground apps so the PC stays usable while it runs."""
    try:
        if os.name == "nt":
            import ctypes
            # BELOW_NORMAL_PRIORITY_CLASS
            ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
        else:
            os.nice(5)
    except Exception:
        # Thread limits still reduce CPU use when OS priority cannot be changed.
        pass


def _result_data(result):
    data = getattr(result, "json", {})
    if callable(data):
        data = data()
    if isinstance(data, str):
        data = json.loads(data)
    return data.get("res", data) if isinstance(data, dict) else {}


def _rows_from_result(result):
    data = _result_data(result)
    texts = data.get("rec_texts", [])
    boxes = data.get("rec_boxes", [])
    scores = data.get("rec_scores", [])
    for name, value in (("texts", texts), ("boxes", boxes), ("scores", scores)):
        if hasattr(value, "tolist"):
            if name == "texts": texts = value.tolist()
            elif name == "boxes": boxes = value.tolist()
            else: scores = value.tolist()
    items = []
    for index, text in enumerate(texts):
        text = str(text).strip()
        if not text or index >= len(boxes):
            continue
        box = boxes[index]
        if hasattr(box, "tolist"):
            box = box.tolist()
        if len(box) < 4:
            continue
        x1, y1, x2, y2 = [float(value) for value in box[:4]]
        score = float(scores[index]) if index < len(scores) else 0.0
        items.append({"text": text, "x": x1, "right": x2, "y": (y1 + y2) / 2, "height": max(1.0, y2-y1), "score": score})

    # Rebuild approximate reading rows from OCR boxes so the existing route
    # extractor can associate labels and handwritten values by their positions.
    items.sort(key=lambda item: (item["y"], item["x"]))
    rows = []
    for item in items:
        target = next((row for row in reversed(rows)
                       if abs(row["y"] - item["y"]) <= max(10.0, min(row["height"], item["height"]) * 0.65)), None)
        if target is None:
            rows.append({"y": item["y"], "height": item["height"], "items": [item]})
        else:
            target["items"].append(item)
            count = len(target["items"])
            target["y"] = (target["y"] * (count - 1) + item["y"]) / count
            target["height"] = max(target["height"], item["height"])
    structured_rows = []
    for row in rows:
        cells = sorted(row["items"], key=lambda item: item["x"])
        structured_rows.append({"cells": [{"text": item["text"], "x": (item["x"] + item["right"]) / 2}
                                for item in cells]})
    markdown = "\n".join("| " + " | ".join(cell["text"] for cell in row["cells"]) + " |"
                         for row in structured_rows)
    return markdown, structured_rows


def read_document(pipeline, input_path: str) -> dict:
    started = time.monotonic()
    print(f"[PaddleOCR] Lendo PDF com OCR local: {os.path.basename(input_path)}.", file=sys.stderr, flush=True)
    pages = []
    for page_number, result in enumerate(pipeline.predict(input=input_path), start=1):
        markdown, rows = _rows_from_result(result)
        pages.append({"page": page_number, "markdown": markdown, "rows": rows})
        print(f"[PaddleOCR] Página {page_number} reconhecida.", file=sys.stderr, flush=True)
    elapsed = time.monotonic() - started
    print(f"[PaddleOCR] Concluído: {len(pages)} página(s) em {elapsed:.1f}s.", file=sys.stderr, flush=True)
    return {"pages": pages}


def main() -> int:
    cpu_threads = max(1, int(os.environ.get("PADDLEOCR_CPU_THREADS", "2")))
    # Set these before importing Paddle so its math libraries do not start one
    # thread per logical CPU and monopolize the machine during inference.
    for variable in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[variable] = str(cpu_threads)
    os.environ["FLAGS_cpu_num_threads"] = str(cpu_threads)
    _limit_worker_priority()

    try:
        import paddle
        from paddleocr import PaddleOCR
    except ImportError as exc:
        print("PaddleOCR não está instalado. Instale paddlepaddle e paddleocr conforme o README.", file=sys.stderr)
        raise exc

    os.environ.setdefault("PADDLE_PDX_MODEL_SOURCE", "BOS")
    requested_device = os.environ.get("PADDLEOCR_DEVICE", "auto").strip().lower()
    if requested_device == "auto":
        has_cuda = paddle.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
        device = "gpu:0" if has_cuda else "cpu"
    else:
        device = requested_device

    print(f"[PaddleOCR] Carregando OCR de texto no dispositivo {device}.", file=sys.stderr, flush=True)
    try:
        paddle.set_num_threads(cpu_threads)
    except Exception:
        pass
    options = {
        "lang": "pt",
        "ocr_version": "PP-OCRv5",
        "device": device,
        "cpu_threads": min(cpu_threads, os.cpu_count() or cpu_threads),
        # Avoid a Paddle 3.x oneDNN/PIR conversion failure seen on Windows CPU.
        # The plain CPU kernels are a little slower but do not use that path.
        "enable_mkldnn": False,
        "use_doc_orientation_classify": True,
        "use_doc_unwarping": False,
        "use_textline_orientation": True,
    }
    try:
        pipeline = PaddleOCR(**options)
    except Exception as exc:
        if requested_device != "auto" or device == "cpu":
            raise
        print(f"[PaddleOCR] GPU indisponível ({exc}); usando CPU.", file=sys.stderr, flush=True)
        options["device"] = "cpu"
        pipeline = PaddleOCR(**options)
        device = "cpu"

    print(f"[PaddleOCR] OCR pronto no dispositivo {device}.", file=sys.stderr, flush=True)
    print(json.dumps({"ready": True}), flush=True)
    for raw_request in sys.stdin:
        request = {}
        try:
            request = json.loads(raw_request)
            response = {"id": request["id"], "result": read_document(pipeline, request["path"])}
        except Exception as exc:
            response = {"id": request.get("id") if isinstance(request, dict) else None, "error": str(exc)}
        print(json.dumps(response, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
