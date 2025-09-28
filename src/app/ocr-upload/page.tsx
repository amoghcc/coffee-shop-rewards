"use client";

import { useState } from "react";
import { db, auth } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function OcrUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ store: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Call Flask OCR
      const res = await fetch("http://127.0.0.1:5000/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("OCR service error");
      }

      const data = await res.json();
      setResult(data);

      // Save to Firestore if logged in
      if (auth.currentUser) {
        await addDoc(
          collection(db, "users", auth.currentUser.uid, "transactions"),
          {
            store: data.store || "Unknown Store",
            amount: Number(data.total || 0),
            points: Math.round(Number(data.total || 0) * 10), // 10 points per $1
            createdAt: serverTimestamp(),
          }
        );
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to process receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Upload Receipt</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? "Processing..." : "Upload & Scan"}
      </button>

      {error && <p className="text-red-600 mt-4">{error}</p>}

      {result && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <p><strong>Store:</strong> {result.store}</p>
          <p><strong>Total:</strong> ${result.total.toFixed(2)}</p>
          <p className="text-green-600 mt-2">Saved to your transactions ✅</p>
        </div>
      )}
    </div>
  );
}
