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
  branches?: Branch[]; // make optional, will fetch if not provided
}

// Default fallback fees (used only if no document exists)
const DEFAULT_CLASS_FEES: Record<string, number> = {
  "B1/B2": 15000,
  "B1": 15000,
  "BC1": 18500,
  "C1": 14500,
  "D1": 11000,
  "A1": 7500,
  "A2": 7500,
  "A3": 7500,
};

// =====================================================
// 🔐 INTERNAL PASSWORD (hardcoded) – change as needed
// =====================================================
const REQUIRED_PASSWORD = "1234";

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
  const [invitationLinks, setInvitationLinks] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Popup state (for the main admin “Open Dashboard”)
  const [openBranchId, setOpenBranchId] = useState<string | null>(null);
  const [branchData, setBranchData] = useState<any[]>([]);
  const [branchName, setBranchName] = useState("");

  // ✅ Class fees from Firestore
  const [classFees, setClassFees] =
    useState<Record<string, number>>(DEFAULT_CLASS_FEES);

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

  // Fetch class fees from Firestore
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

  // ✅ Fetch branches if not provided
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

  const handleGenerate = async (branchId: string) => {
    const password = passwords[branchId];
    if (!password) {
      setError("Please enter a password for this branch");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const fullLink = `${window.location.origin}/branch-access?token=${data.token}`;
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
        // Compute total fee based on enrolled classes and current classFees
        let totalFee = data.totalFee; // use stored if exists
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
    );
  }

  // --- Authenticated view: all text black, branch cards with blue hover, visible on white ---
  if (!branches.length && !error) {
    return (
      <div className="p-4 sm:p-6 text-black text-sm">
        Loading branches...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
        Manage Branch Invitations
      </h1>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

      <div className="space-y-4 sm:space-y-6">
        {branches.map((branch) => (
          <div 
            key={branch.id} 
            className="bg-white border border-gray-300 p-3 sm:p-4 rounded-lg shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-black mb-1 sm:mb-2">
              {branch.name}
            </h2>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-black/70 text-xs sm:text-sm mb-1">
                  Password
                </label>
                <input
                  type="text"
                  value={passwords[branch.id] || ""}
                  onChange={(e) =>
                    handlePasswordChange(branch.id, e.target.value)
                  }
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-300 rounded text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <p className="text-black/70 text-xs sm:text-sm">Invitation link:</p>
                <code className="block bg-gray-100 p-2 rounded break-all text-xs sm:text-sm text-black border border-gray-200">
                  {invitationLinks[branch.id]}
                </code>
                <p className="text-yellow-700 text-xs sm:text-sm mt-1">
                  Password: {passwords[branch.id]}
                </p>
                <p className="text-red-600 text-xs mt-2">
                  ⚠️ The user must enter the above password when accessing this link to view the branch dashboard.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Popup for main admin – visible on white background */}
      {openBranchId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              backgroundColor: "#052E16",
              padding: "20px",
              borderRadius: "10px",
              width: "80%",
              maxHeight: "80%",
              overflowY: "auto",
              color: "#fff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <button
              onClick={() => setOpenBranchId(null)}
              style={{
                float: "right",
                background: "#000",
                color: "#fff",
                padding: "5px 10px",
                border: "none",
                borderRadius: "5px",
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
                      border: "1px solid #ebe5e5",
                      padding: "10px",
                      marginBottom: "10px",
                      borderRadius: "5px",
                    }}
                  >
                    <p><strong>Name:</strong> {student.name}</p>
                    <p><strong>Account Number:</strong> {student.accountNumber || student.id}</p>
                    <p><strong>Classes Enrolled:</strong> {classesList}</p>
                    <p><strong>Total Fee:</strong> Ksh {totalFee}</p>
                    <p><strong>Paid:</strong> Ksh {paid}</p>
                    <p><strong>Balance:</strong> Ksh {balance}</p>
                    <p><strong>Phone:</strong> {student.phone || "N/A"}</p>
                    <p><strong>ID Number:</strong> {student.idNumber || "N/A"}</p>
                    <p><strong>Reg. Date:</strong> {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : "Unknown"}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}