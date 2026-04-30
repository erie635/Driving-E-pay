// app/dashboard/overpayments/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

// =====================================================
// 🔐 INTERNAL PASSWORD (hardcoded) – change as needed
// =====================================================
const REQUIRED_PASSWORD = "1234";

interface OverpaidStudent {
  branchId: string;
  branchName: string;
  studentId: string;
  studentName: string;
  phone: string;
  totalFee: number;
  feePaid: number;
  overpaidAmount: number;
}

export default function OverpaymentsPage() {
  // --- Password protection ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- State for overpaid students ---
  const [overpaidList, setOverpaidList] = useState<OverpaidStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Refund modal state ---
  const [selectedStudent, setSelectedStudent] = useState<OverpaidStudent | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // --- Fetch all branches and find overpaid students ---
  const fetchOverpaidStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const branchesSnap = await getDocs(collection(db, "branches"));
      const branches = branchesSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.id,
      }));

      const overpaid: OverpaidStudent[] = [];

      for (const branch of branches) {
        const studentsRef = collection(db, "branches", branch.id, "students");
        const studentsSnap = await getDocs(studentsRef);

        for (const studentDoc of studentsSnap.docs) {
          const data = studentDoc.data();
          const totalFee = data.totalFee || 0;
          const feePaid = data.feePaid || 0;
          if (feePaid > totalFee) {
            overpaid.push({
              branchId: branch.id,
              branchName: branch.name,
              studentId: studentDoc.id,
              studentName: data.name || "Unknown",
              phone: data.phone || "N/A",
              totalFee,
              feePaid,
              overpaidAmount: feePaid - totalFee,
            });
          }
        }
      }

      setOverpaidList(overpaid);
    } catch (err) {
      console.error(err);
      setError("Failed to load overpaid students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOverpaidStudents();
    }
  }, [isAuthenticated]);

  // --- Handle password submission ---
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // --- Open refund modal for a student ---
  const openRefundModal = (student: OverpaidStudent) => {
    setSelectedStudent(student);
    setRefundAmount("");
    setRefundReason("");
    setModalError("");
    setModalSuccess("");
  };

  // --- Process refund ---
  const handleRefund = async () => {
    if (!selectedStudent) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      setModalError("Please enter a valid positive amount.");
      return;
    }
    if (amount > selectedStudent.overpaidAmount) {
      setModalError(`Refund cannot exceed overpaid amount of Ksh ${selectedStudent.overpaidAmount}.`);
      return;
    }
    if (!refundReason.trim()) {
      setModalError("Please provide a reason for the refund.");
      return;
    }

    setProcessing(true);
    setModalError("");
    setModalSuccess("");

    try {
      // 1. Update student's feePaid
      const studentRef = doc(
        db,
        "branches",
        selectedStudent.branchId,
        "students",
        selectedStudent.studentId
      );
      const newFeePaid = selectedStudent.feePaid - amount;
      await updateDoc(studentRef, { feePaid: newFeePaid });

      // 2. Log refund in subcollection "refunds"
      const refundsRef = collection(
        db,
        "branches",
        selectedStudent.branchId,
        "students",
        selectedStudent.studentId,
        "refunds"
      );
      await addDoc(refundsRef, {
        amount: amount,
        reason: refundReason.trim(),
        date: Timestamp.now(),
        previousFeePaid: selectedStudent.feePaid,
        newFeePaid: newFeePaid,
        admin: "authenticated_user", // optional: you could add user email from auth
      });

      setModalSuccess(`✅ Refund of Ksh ${amount} recorded. Student's paid amount updated.`);

      // 3. Refresh the list after a short delay
      setTimeout(() => {
        fetchOverpaidStudents();
        closeModal();
      }, 1500);
    } catch (err) {
      console.error(err);
      setModalError("Failed to process refund. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setRefundAmount("");
    setRefundReason("");
    setModalError("");
    setModalSuccess("");
    setProcessing(false);
  };

  // --- Render password screen if not authenticated ---
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
            background-color: #5A37E7;
            color: #fff;
            padding: 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.9rem;
          }
          @media (min-width: 640px) {
            .password-card {
              padding: 1.5rem;
              max-width: 24rem;
            }
            .password-card h2 {
              font-size: 1.5rem;
            }
          }
        `}</style>
        <div className="password-container">
          <div className="password-card">
            <img src="/logopds.jpg" alt="Logo" />
            <h2>Overpayment Refunds</h2>
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

  // --- Authenticated view (text visibility fixed) ---
  return (
    <>
      <style>{`
        /* Global text visibility on white background */
        body, .overpayments-container, .overpayments-container * {
          color: #000000 !important;
        }
        /* Except for elements that need different colors: */
        .overpayments-container .error {
          color: #dc2626 !important;
          background-color: #fee2e2;
        }
        .overpayments-container table {
          background-color: #052E16;
        }
        .overpayments-container td {
          color: #fff !important;  /* ensures white text on blue table rows */
        }
        .overpayments-container th {
          color: #000000 !important;  /* black text on light gray header */
          background-color: #ffea00;
        }
        .overpayments-container .refund-btn {
          color: white !important;
          background-color: #dc2626;
        }
        .overpayments-container .refund-btn:hover {
          background-color: #b91c1c;
        }
        .overpayments-container .subtitle {
          color: #000000 !important;
        }
        .overpayments-container .text-gray-800 {
          color: #000000 !important;
        }
        /* Modal text – white on dark blue background */
        .modal-content {
          background-color: #1e3a8a;
          color: white !important;
        }
        .modal-content label, .modal-content h2, .modal-content p, .modal-content strong {
          color: white !important;
        }
        .modal-content input, .modal-content textarea {
          color: #000000 !important;
          background-color: white;
        }
        .modal-error {
          color: #fca5a5 !important;
        }
        .modal-success {
          color: #a7f3d0 !important;
        }
        .modal-buttons .cancel-btn, .modal-buttons .save-btn {
          color: white !important;
        }
        /* Override any unwanted overrides */
        .overpayments-container a, .overpayments-container button:not(.refund-btn) {
          color: inherit;
        }
        .overpayments-container {
          padding: 0.75rem;
          max-width: 1200px;
          margin: 0 auto;
          font-size: 0.75rem;
        }
        @media (min-width: 640px) {
          .overpayments-container {
            padding: 1rem;
            font-size: 0.85rem;
          }
        }
        h1 {
          font-size: 1.2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          margin-bottom: 1rem;
          font-size: 0.7rem;
        }
        .error {
          padding: 0.5rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 0.5rem;
          overflow-x: auto;
          display: block;
        }
        thead {
          background-color: #f9fafb;
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
        }
        @media (min-width: 640px) {
          th, td {
            padding: 0.75rem;
          }
          th {
            font-size: 0.7rem;
          }
        }
        .refund-btn {
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          border: none;
          cursor: pointer;
        }
        /* Modal overlay */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }
        .modal-content {
          padding: 1rem;
          border-radius: 0.5rem;
          width: 100%;
          max-width: 28rem;
        }
        .modal-content label {
          display: block;
          font-size: 0.7rem;
          margin-bottom: 0.25rem;
        }
        .modal-content input, .modal-content textarea {
          width: 100%;
          padding: 0.3rem;
          margin-bottom: 0.75rem;
          border-radius: 0.25rem;
          border: none;
          font-size: 0.8rem;
        }
        .modal-buttons {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        .modal-buttons button {
          padding: 0.3rem 0.8rem;
          border-radius: 0.25rem;
          font-size: 0.7rem;
          cursor: pointer;
        }
        .save-btn {
          background-color: #10b981;
        }
        .cancel-btn {
          background-color: #6b7280;
        }
        .modal-error {
          font-size: 0.7rem;
          margin-bottom: 0.5rem;
        }
        .modal-success {
          font-size: 0.7rem;
          margin-bottom: 0.5rem;
        }
        @media (min-width: 640px) {
          .modal-content {
            padding: 1.5rem;
          }
          .modal-content label {
            font-size: 0.8rem;
          }
        }
      `}</style>

      <div className="overpayments-container">
        <h1>💰 Overpaid Students (Excess Payments)</h1>
        <p className="subtitle">
          Students who have paid more than their total fee. Use the refund option to correct overpayments.
        </p>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="text-center py-8 text-amber-500">Loading overpaid students...</div>
        ) : overpaidList.length === 0 ? (
          <div className="text-center py-8 text-amber-500">✅ No overpaid students found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Student Name</th>
                  <th>Phone</th>
                  <th>Total Fee (Ksh)</th>
                  <th>Paid (Ksh)</th>
                  <th>Overpaid (Ksh)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {overpaidList.map((student) => (
                  <tr key={`${student.branchId}-${student.studentId}`}>
                    <td>{student.branchName}</td>
                    <td>{student.studentName}</td>
                    <td>{student.phone}</td>
                    <td>{student.totalFee.toLocaleString()}</td>
                    <td>{student.feePaid.toLocaleString()}</td>
                    <td className="text-red-600 font-semibold">
                      {student.overpaidAmount.toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="refund-btn"
                        onClick={() => openRefundModal(student)}
                      >
                        Refund
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Process Refund</h2>
            <p className="text-sm mb-2">
              <strong>Student:</strong> {selectedStudent.studentName}<br />
              <strong>Branch:</strong> {selectedStudent.branchName}<br />
              <strong>Overpaid amount:</strong> Ksh {selectedStudent.overpaidAmount.toLocaleString()}
            </p>
            <label>Refund Amount (Ksh)</label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Enter amount to refund"
              disabled={processing}
            />
            <label>Reason for Refund</label>
            <textarea
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain why this refund is being made (required)"
              disabled={processing}
            />
            {modalError && <div className="modal-error">{modalError}</div>}
            {modalSuccess && <div className="modal-success">{modalSuccess}</div>}
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={closeModal} disabled={processing}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleRefund} disabled={processing}>
                {processing ? "Processing..." : "Confirm Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}