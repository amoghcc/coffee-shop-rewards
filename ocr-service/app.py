from flask import Flask, request, jsonify
from flask_cors import CORS   # ✅ new
import doctr.models as models
from doctr.io import DocumentFile
import tempfile, os, re, json

app = Flask(__name__)
CORS(app)  # ✅ enable CORS so Next.js can call Flask

model = models.ocr_predictor(pretrained=True)

# Load participating stores from JSON
with open("stores.json", "r") as f:
    PARTICIPATING_STORES = json.load(f)["participatingStores"]

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/ocr", methods=["POST"])
def ocr():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    try:
        doc = DocumentFile.from_images(tmp_path)
        result = model(doc)
        text = result.render()

        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

        # --- Store detection ---
        store = "Unknown Store"
        for ln in lines:
            up = ln.upper()
            for brand in PARTICIPATING_STORES:
                if brand in up:
                    store = brand
                    break
            if store != "Unknown Store":
                break

        # --- Total detection ---
        TOTAL_KEYS = ["TOTAL", "AMOUNT DUE", "BALANCE DUE", "TOTAL PURCHASE"]
        total = 0.0
        for ln in lines:
            up = ln.upper()
            if any(k in up for k in TOTAL_KEYS):
                amts = re.findall(r"\$?\s*\d{1,3}(?:,\d{3})*\.\d{2}", ln)
                if amts:
                    val = amts[-1].replace("$", "").replace(",", "").strip()
                    total = float(val)
                    break

        if total == 0.0:
            amts = re.findall(r"\$?\s*\d{1,3}(?:,\d{3})*\.\d{2}", text)
            if amts:
                total = max(float(a.replace("$", "").replace(",", "").strip()) for a in amts)

        return jsonify({"store": store, "total": total})

    finally:
        os.remove(tmp_path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
