"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

interface Branch {
  id: string;
  name: string;
  slug: string;
}

interface BranchInvitationManagerProps {
  branches?: Branch[];
}

const DEFAULT_CLASS_FEES: Record<string, number> = {
  "B1/B2": 15000,
  C1: 18500,
  A1: 7500,
  A2: 7500,
  A3: 7500,
};

// Hardcoded admin password (no .env)
const REQUIRED_PASSWORD = "admin123";

export default function BranchInvitationManager({
  branches: propBranches,
}: BranchInvitationManagerProps) {
  // --- Password protection state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- Original state variables ---
  const [branches, setBranches] = useState<Branch[]>(propBranches || []);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [invitationLinks, setInvitationLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Popup state
  const [openBranchId, setOpenBranchId] = useState<string | null>(null);
  const [branchData, setBranchData] = useState<any[]>([]);
  const [branchName, setBranchName] = useState("");

  const [classFees, setClassFees] = useState<Record<string, number>>(DEFAULT_CLASS_FEES);

  // --- Password handler ---
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // Fetch class fees
  useEffect(() => {
    const fetchClassFees = async () => {
      try {
        const feesDocRef = doc(db, "settings", "classFees");
        const feesDoc = await getDoc(feesDocRef);
        if (feesDoc.exists()) {
          setClassFees(feesDoc.data() as Record<string, number>);
        }
      } catch (err) {
        console.error("Error fetching class fees:", err);
      }
    };
    fetchClassFees();
  }, []);

  // Fetch branches if not provided
  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
      setBranches(propBranches);
      return;
    }
    const fetchBranches = async () => {
      try {
        const snapshot = await getDocs(collection(db, "branches"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          slug: doc.data().slug || "",
        }));
        setBranches(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load branches");
      }
    };
    fetchBranches();
  }, [propBranches]);

  const handlePasswordChange = (branchId: string, value: string) => {
    setPasswords((prev) => ({ ...prev, [branchId]: value }));
  };

  // Revoke existing invitation for a branch (disable old link)
  const revokeExistingInvitation = async (branchId: string) => {
    try {
      // Assuming your backend has a DELETE or POST endpoint to revoke by branchId
      // Adjust the URL to match your actual API route (e.g., `/api/invite/revoke`)
      const res = await fetch(`/api/invite/revoke?branchId=${branchId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        console.warn("Failed to revoke old invitation for branch", branchId);
      }
    } catch (err) {
      console.warn("Error revoking old invitation:", err);
    }
  };

  const handleGenerate = async (branchId: string) => {
    const password = passwords[branchId];
    if (!password) {
      setError("Please enter a password for this branch");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Disable any existing link for this branch (so old token stops working)
      await revokeExistingInvitation(branchId);

      // 2. Generate a brand new token with the new password
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const fullLink = `${window.location.origin}/branch-access?token=${data.token}`;
      // Replace the old link with the new one (UI only shows the latest)
      setInvitationLinks((prev) => ({ ...prev, [branchId]: fullLink }));
    } catch (err: any) {
      setError(err.message || "Failed to generate invitation");
    } finally {
      setLoading(false);
    }
  };

  const openDashboard = async (branchId: string) => {
    setOpenBranchId(branchId);
    try {
      const branchRef = doc(db, "branches", branchId);
      const branchSnap = await getDoc(branchRef);
      setBranchName(
        branchSnap.exists() ? branchSnap.data().name || branchId : branchId,
      );

      const studentsRef = collection(db, "branches", branchId, "students");
      const snapshot = await getDocs(studentsRef);
      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const classes = data.classes || [];
        let totalFee = data.totalFee;
        if (!totalFee && classes.length) {
          totalFee = classes.reduce(
            (sum, cls) => sum + (classFees[cls] || 0),
            0,
          );
        } else if (!totalFee) {
          totalFee = 0;
        }
        const feePaid = Number(data.feePaid) || 0;
        const balance = totalFee - feePaid;
        return {
          id: docSnap.id,
          ...data,
          totalFee,
          balance: balance > 0 ? balance : 0,
          classes,
        };
      });
      setBranchData(list);
    } catch (err) {
      console.error(err);
    }
  };

  // --- Render password prompt if not authenticated ---
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          /* Password screen responsive + small fonts */
          .min-h-screen {
            min-height: 100vh;
          }
          .bg-gray-100 {
            background-color: #f3f4f6;
          }
          .p-4 {
            padding: 1rem;
          }
          .bg-white {
            background-color: #ffffff;
          }
          .rounded-lg {
            border-radius: 0.5rem;
          }
          .shadow-md {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .w-full {
            width: 100%;
          }
          .max-w-sm {
            max-width: 24rem;
          }
          .mx-auto {
            margin-left: auto;
            margin-right: auto;
          }
          .mb-4 {
            margin-bottom: 1rem;
          }
          .w-20 {
            width: 5rem;
          }
          .h-20 {
            height: 5rem;
          }
          .object-contain {
            object-fit: contain;
          }
          .text-black {
            color: #000;
          }
          .font-bold {
            font-weight: 700;
          }
          .text-center {
            text-align: center;
          }
          .text-xl {
            font-size: 1.25rem;
          }
          .sm\\:text-2xl {
            font-size: 1.5rem;
          }
          .mb-4 {
            margin-bottom: 1rem;
          }
          input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ccc;
            border-radius: 0.25rem;
            font-size: 0.875rem;
          }
          .text-red-500 {
            color: #ef4444;
          }
          .bg-indigo-600 {
            background-color: #4f46e5;
          }
          .hover\\:bg-indigo-700:hover {
            background-color: #4338ca;
          }
          .text-white {
            color: white;
          }
          .py-2 {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
          .rounded {
            border-radius: 0.25rem;
          }
          /* Responsive adjustments */
          @media (max-width: 640px) {
            .p-4 {
              padding: 0.75rem;
            }
            .w-20 {
              width: 3rem;
              height: 3rem;
            }
            .text-xl {
              font-size: 1.125rem;
            }
            input {
              font-size: 0.75rem;
              padding: 0.4rem;
            }
            button {
              font-size: 0.75rem;
            }
          }
        `}</style>
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-sm sm:w-96">
            <img
              src="/logopds.jpg"
              alt="Logo"
              className="mx-auto mb-4 w-20 h-20 sm:w-24 sm:h-24 object-contain"
            />
            <h2 className="text-xl sm:text-2xl text-black font-bold mb-4 text-center">
              Access Branch Level Links
            </h2>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full text-black p-2 border rounded mb-4 text-sm sm:text-base"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-xs sm:text-sm mb-4">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 text-sm sm:text-base"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // --- Authenticated view with embedded CSS overrides ---
  return (
    <>
      <style>{`
        /* Main container */
        .p-4.sm\\:p-6.max-w-4xl.mx-auto {
          padding: 0.75rem !important;
          max-width: 56rem;
          margin-left: auto;
          margin-right: auto;
        }
        @media (min-width: 640px) {
          .p-4.sm\\:p-6.max-w-4xl.mx-auto {
            padding: 1rem !important;
          }
        }
        /* Title */
        .text-xl.sm\\:text-2xl.font-bold.text-white.mb-4.sm\\:mb-6 {
          font-size: 1.2rem !important;
          font-weight: bold;
          color: white;
          margin-bottom: 0.75rem;
        }
        @media (min-width: 640px) {
          .text-xl.sm\\:text-2xl.font-bold.text-white.mb-4.sm\\:mb-6 {
            font-size: 1.4rem !important;
            margin-bottom: 1rem;
          }
        }
        /* Error message */
        .text-red-400.mb-3.text-sm {
          font-size: 0.75rem;
          color: #f87171;
          margin-bottom: 0.5rem;
        }
        /* Branch cards container */
        .space-y-4.sm\\:space-y-6 {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        @media (min-width: 640px) {
          .space-y-4.sm\\:space-y-6 {
            gap: 1rem;
          }
        }
        /* Individual branch card */
        .bg-white\\/10.p-3.sm\\:p-4.rounded-lg {
          background: rgba(255,255,255,0.1);
          padding: 0.75rem;
          border-radius: 0.5rem;
        }
        @media (min-width: 640px) {
          .bg-white\\/10.p-3.sm\\:p-4.rounded-lg {
            padding: 1rem;
          }
        }
        /* Branch name */
        .text-lg.sm\\:text-xl.font-semibold.text-white.mb-1.sm\\:mb-2 {
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }
        @media (min-width: 640px) {
          .text-lg.sm\\:text-xl.font-semibold.text-white.mb-1.sm\\:mb-2 {
            font-size: 1.125rem;
            margin-bottom: 0.5rem;
          }
        }
        /* Flex row controls */
        .flex.flex-col.sm\\:flex-row.flex-wrap.gap-3.sm\\:gap-4.items-stretch.sm\\:items-end {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        @media (min-width: 640px) {
          .flex.flex-col.sm\\:flex-row.flex-wrap.gap-3.sm\\:gap-4.items-stretch.sm\\:items-end {
            flex-direction: row;
            gap: 0.75rem;
          }
        }
        /* Input label */
        .block.text-white\\/70.text-xs.sm\\:text-sm.mb-1 {
          font-size: 0.65rem;
          margin-bottom: 0.2rem;
        }
        @media (min-width: 640px) {
          .block.text-white\\/70.text-xs.sm\\:text-sm.mb-1 {
            font-size: 0.7rem;
          }
        }
        /* Input field */
        input[type="text"] {
          padding: 0.3rem 0.5rem;
          font-size: 0.7rem;
        }
        @media (min-width: 640px) {
          input[type="text"] {
            padding: 0.4rem 0.75rem;
            font-size: 0.8rem;
          }
        }
        /* Buttons */
        button {
          font-size: 0.7rem;
          padding: 0.3rem 0.75rem;
        }
        @media (min-width: 640px) {
          button {
            font-size: 0.8rem;
            padding: 0.4rem 1rem;
          }
        }
        /* Invitation link code block */
        code {
          font-size: 0.65rem;
          padding: 0.3rem;
        }
        @media (min-width: 640px) {
          code {
            font-size: 0.75rem;
            padding: 0.5rem;
          }
        }
        /* Warning text */
        .text-yellow-300.text-xs.sm\\:text-sm.mt-1,
        .text-red-300.text-xs.mt-2 {
          font-size: 0.6rem;
        }
        @media (min-width: 640px) {
          .text-yellow-300.text-xs.sm\\:text-sm.mt-1,
          .text-red-300.text-xs.mt-2 {
            font-size: 0.7rem;
          }
        }
        /* Loading text */
        .p-4.sm\\:p-6.text-white.text-sm {
          font-size: 0.75rem;
          padding: 1rem;
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
          Manage Branch Invitations
        </h1>
        {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

        <div className="space-y-4 sm:space-y-6">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white/10 p-3 sm:p-4 rounded-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">
                {branch.name}
              </h2>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-white/70 text-xs sm:text-sm mb-1">
                    Password
                  </label>
                  <input
                    type="text"
                    value={passwords[branch.id] || ""}
                    onChange={(e) =>
                      handlePasswordChange(branch.id, e.target.value)
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white/20 rounded text-white border border-white/20 text-sm"
                    placeholder="Set branch password"
                  />
                </div>
                <button
                  onClick={() => handleGenerate(branch.id)}
                  disabled={loading}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50 text-sm sm:text-base"
                >
                  Generate Invitation
                </button>
                <button
                  onClick={() => openDashboard(branch.id)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm sm:text-base"
                >
                  Open Dashboard
                </button>
              </div>

              {invitationLinks[branch.id] && (
                <div className="mt-3">
                  <p className="text-white/70 text-xs sm:text-sm">Invitation link:</p>
                  <code className="block bg-black/30 p-2 rounded break-all text-xs sm:text-sm text-white">
                    {invitationLinks[branch.id]}
                  </code>
                  <p className="text-yellow-300 text-xs sm:text-sm mt-1">
                    Password: {passwords[branch.id]}
                  </p>
                  <p className="text-red-300 text-xs mt-2">
                    ⚠️ The user must enter the above password when accessing this link to view the branch dashboard.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Popup – inline styles untouched */}
        {openBranchId && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <div
              style={{
                backgroundColor: "#ff2d2d",
                padding: "20px",
                borderRadius: "10px",
                width: "80%",
                maxHeight: "80%",
                overflowY: "auto",
                color: "white",
              }}
            >
              <button
                onClick={() => setOpenBranchId(null)}
                style={{
                  float: "right",
                  background: "black",
                  color: "white",
                  padding: "5px 10px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <h2 style={{ marginBottom: "20px" }}>
                ✅ Branch Dashboard: {branchName}
              </h2>
              {branchData.length === 0 ? (
                <p>No students found</p>
              ) : (
                branchData.map((student) => {
                  const paid = student.feePaid || 0;
                  const balance = student.balance;
                  const totalFee = student.totalFee || 0;
                  const classesList = student.classes?.join(", ") || "None";

                  return (
                    <div
                      key={student.id}
                      style={{
                        border: "1px solid white",
                        padding: "10px",
                        marginBottom: "10px",
                        borderRadius: "5px",
                      }}
                    >
                      <p>
                        <strong>Name:</strong> {student.name}
                      </p>
                      <p>
                        <strong>Account Number:</strong>{" "}
                        {student.accountNumber || student.id}
                      </p>
                      <p>
                        <strong>Classes Enrolled:</strong> {classesList}
                      </p>
                      <p>
                        <strong>Total Fee:</strong> Ksh {totalFee}
                      </p>
                      <p>
                        <strong>Paid:</strong> Ksh {paid}
                      </p>
                      <p>
                        <strong>Balance:</strong> Ksh {balance}
                      </p>
                      <p>
                        <strong>Phone:</strong> {student.phone || "N/A"}
                      </p>
                      <p>
                        <strong>ID Number:</strong> {student.idNumber || "N/A"}
                      </p>
                      <p>
                        <strong>Reg. Date:</strong>{" "}
                        {student.createdAt
                          ? new Date(
                              student.createdAt.seconds * 1000,
                            ).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}