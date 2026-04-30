// app/dashboard/refund-logs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";

// Password from environment variable (same or different from overpayments)
const REQUIRED_PASSWORD =
  process.env.NEXT_PUBLIC_REFUND_LOGS_PASSWORD || "refundLogs456";

interface RefundLog {
  id: string;
  branchId: string;
  branchName: string;
  studentId: string;
  studentName: string;
  amount: number;
  reason: string;
  date: Date;
  previousFeePaid: number;
  newFeePaid: number;
}

export default function RefundLogsPage() {
  // Password protection
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Refund logs state
  const [logs, setLogs] = useState<RefundLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // Fetch all refunds from all branches
  const fetchAllRefunds = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Get all branches
      const branchesSnap = await getDocs(collection(db, "branches"));
      const branches = branchesSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.id,
      }));

      const allRefunds: RefundLog[] = [];

      // 2. For each branch, get all students and their refunds subcollection
      for (const branch of branches) {
        const studentsRef = collection(db, "branches", branch.id, "students");
        const studentsSnap = await getDocs(studentsRef);

        for (const studentDoc of studentsSnap.docs) {
          const studentData = studentDoc.data();
          const studentName = studentData.name || "Unknown";
          const refundsRef = collection(
            db,
            "branches",
            branch.id,
            "students",
            studentDoc.id,
            "refunds"
          );
          const refundsSnap = await getDocs(query(refundsRef, orderBy("date", "desc")));

          refundsSnap.forEach((refundDoc) => {
            const data = refundDoc.data();
            allRefunds.push({
              id: refundDoc.id,
              branchId: branch.id,
              branchName: branch.name,
              studentId: studentDoc.id,
              studentName: studentName,
              amount: data.amount || 0,
              reason: data.reason || "No reason provided",
              date: data.date?.toDate() || new Date(),
              previousFeePaid: data.previousFeePaid || 0,
              newFeePaid: data.newFeePaid || 0,
            });
          });
        }
      }

      // Sort all refunds by date (newest first)
      allRefunds.sort((a, b) => b.date.getTime() - a.date.getTime());
      setLogs(allRefunds);
    } catch (err) {
      console.error("Error fetching refund logs:", err);
      setError("Failed to load refund logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllRefunds();
    }
  }, [isAuthenticated]);

  // Password screen
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          .password-container {
            min-height: 100vh;
            background-color: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .password-card {
            background-color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 20rem;
          }
          .password-card img {
            width: 5rem;
            height: 5rem;
            margin: 0 auto 1rem auto;
            object-fit: contain;
          }
          .password-card h2 {
            font-size: 1.2rem;
            color: black;
            margin-bottom: 0.75rem;
            text-align: center;
          }
          .password-card input {
            width: 100%;
            padding: 0.4rem;
            border: 1px solid #ccc;
            border-radius: 0.25rem;
            margin-bottom: 0.75rem;
            font-size: 0.8rem;
            color: #000;
          }
          .password-card button {
            width: 100%;
            background-color: #4f46e5;
            color: white;
            padding: 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.8rem;
          }
          @media (min-width: 640px) {
            .password-card {
              padding: 1.5rem;
              max-width: 24rem;
            }
            .password-card h2 {
              font-size: 1.5rem;
            }
            .password-card input, .password-card button {
              font-size: 0.9rem;
              padding: 0.5rem;
            }
          }
        `}</style>
        <div className="password-container">
          <div className="password-card">
            <img src="/logopds.jpg" alt="Logo" />
            <h2>Refund Logs – Admin Access</h2>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                placeholder="Enter admin password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              {passwordError && <p style={{ color: "#ef4444", fontSize: "0.7rem", marginBottom: "0.5rem" }}>{passwordError}</p>}
              <button type="submit">Unlock</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // Authenticated view
  return (
    <>
      <style>{`
        .logs-container {
          padding: 0.75rem;
          max-width: 1400px;
          margin: 0 auto;
          font-size: 0.75rem;
        }
        @media (min-width: 640px) {
          .logs-container {
            padding: 1rem;
            font-size: 0.85rem;
          }
        }
        h1 {
          font-size: 1.2rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
        }
        .subtitle {
          color: #4b5563;
          margin-bottom: 1rem;
          font-size: 0.7rem;
        }
        .error {
          color: #dc2626;
          background-color: #fee2e2;
          padding: 0.5rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background-color: #052E16;
          border-radius: 0.5rem;
          overflow-x: auto;
          display: block;
        }
        thead {
          background-color: #FDE047;
        }
        th, td {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        th {
          font-size: 0.65rem;
          text-transform: uppercase;
          font-weight: 500;
          color: #6b7280;
        }
        @media (min-width: 640px) {
          th, td {
            padding: 0.75rem;
          }
          th {
            font-size: 0.7rem;
          }
        }
        .reason-cell {
          max-width: 300px;
          word-wrap: break-word;
        }
        .loading-text {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }
      `}</style>
      <div>
      <div className="logs-container text-gray-500">
        <h1>📝 Refund Logs & Notes</h1>
        <p className="subtitle">
          Complete history of all refunds processed. Each refund includes the reason provided by the admin.
        </p>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading-text">Loading refund records...</div>
        ) : logs.length === 0 ? (
          <div className="loading-text">No refunds have been recorded yet.</div>
        ) : (
          
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Branch</th>
                  <th>Student Name</th>
                  <th>Refund Amount (Ksh)</th>
                  <th>Reason / Note</th>
                  <th>Previous Paid</th>
                  <th>New Paid</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {log.date.toLocaleDateString()} {log.date.toLocaleTimeString()}
                    </td>
                    <td>{log.branchName}</td>
                    <td>{log.studentName}</td>
                    <td className="text-red-600 font-semibold">{log.amount.toLocaleString()}</td>
                    <td className="reason-cell">{log.reason}</td>
                    <td>{log.previousFeePaid.toLocaleString()}</td>
                    <td>{log.newFeePaid.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
} 