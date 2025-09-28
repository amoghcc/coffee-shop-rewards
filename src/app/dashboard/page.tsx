"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { QRCodeCanvas } from "qrcode.react"; // ✅ QR code component

type Transaction = {
  id: string;
  store: string;
  amount: number;
  points: number;
  createdAt?: any;
};

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [store, setStore] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        window.location.href = "/login";
      } else {
        setUser(u);
      }
    });
    return () => unsubscribe();
  }, []);

  // Transaction listener
  useEffect(() => {
    if (!user) return;

    // /users/{uid}/transactions
    const txRef = collection(db, "users", user.uid, "transactions");
    const q = query(txRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Transaction)
      );
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Add transaction (manual)
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !amount || !user) return;

    const points = Math.round(Number(amount) * 10); // 10 pts per $1

    const txRef = collection(db, "users", user.uid, "transactions");
    await addDoc(txRef, {
      store,
      amount: Number(amount),
      points,
      createdAt: serverTimestamp(),
    });

    setStore("");
    setAmount("");
  };

  // Redeem 100 points (negative transaction)
  const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);
  const handleRedeem = async () => {
    if (totalPoints < 100 || !user) {
      alert("Not enough points!");
      return;
    }
    const txRef = collection(db, "users", user.uid, "transactions");
    await addDoc(txRef, {
      store: "Reward Redemption",
      amount: 0,
      points: -100,
      createdAt: serverTimestamp(),
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      {user && <p className="mb-4">Welcome, {user.email}</p>}

      {/* Points + Redeem */}
      <h2 className="text-lg font-bold mb-2">Total Points: {totalPoints}</h2>
      <button
        onClick={handleRedeem}
        className="mb-6 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        disabled={totalPoints < 100}
      >
        Redeem 100 Points
      </button>

      {/* ✅ QR Code for this user */}
      {user && (
        <div className="mb-8 flex flex-col items-center">
          <h3 className="font-semibold mb-2">Your QR Code</h3>
          <QRCodeCanvas
            value={user.uid}        // encode Firebase UID
            size={180}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
            includeMargin={true}
          />
          <p className="text-sm text-gray-600 mt-2">
            Show this at checkout to redeem points
          </p>
        </div>
      )}

      {/* Add transaction form (manual entry) */}
      <form onSubmit={handleAddTransaction} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Store"
          className="border px-3 py-2 rounded"
          value={store}
          onChange={(e) => setStore(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount ($)"
          className="border px-3 py-2 rounded"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value ? Number(e.target.value) : "")
          }
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add
        </button>
      </form>

      {/* Transactions list */}
      {loading ? (
        <p>Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <ul className="w-full max-w-md space-y-2">
          {transactions.map((t) => (
            <li
              key={t.id}
              className="border rounded p-3 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">{t.store}</p>
                <p className="text-sm text-gray-600">
                  ${t.amount.toFixed(2)} • {t.points} pts
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {t.createdAt?.toDate
                  ? t.createdAt.toDate().toLocaleString()
                  : "Pending..."}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={handleLogout}
        className="mt-8 bg-red-500 text-white px-4 py-2 rounded"
      >
        Logout
      </button>
    </main>
  );
}
