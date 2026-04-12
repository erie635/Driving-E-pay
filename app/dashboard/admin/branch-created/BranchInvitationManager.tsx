'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase/client';
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

interface Branch {
  id: string;
  name: string;
  slug: string;
}

interface BranchInvitationManagerProps {
  branches: Branch[];
}

const TOTAL_FEE = 18500;

export default function BranchInvitationManager({
  branches,
}: BranchInvitationManagerProps) {
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [invitationLinks, setInvitationLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ POPUP STATE
  const [openBranchId, setOpenBranchId] = useState<string | null>(null);
  const [branchData, setBranchData] = useState<any[]>([]);
  const [branchName, setBranchName] = useState('');

  // =========================
  // PASSWORD HANDLER
  // =========================
  const handlePasswordChange = (branchId: string, value: string) => {
    setPasswords((prev) => ({ ...prev, [branchId]: value }));
  };

  // =========================
  // GENERATE INVITE LINK
  // =========================
  const handleGenerate = async (branchId: string) => {
    const password = passwords[branchId];

    if (!password) {
      setError('Please enter a password for this branch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const fullLink = `${window.location.origin}/branch-access?token=${data.token}`;

      setInvitationLinks((prev) => ({
        ...prev,
        [branchId]: fullLink,
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to generate invitation');
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // OPEN DASHBOARD POPUP
  // =========================
  const openDashboard = async (branchId: string) => {
    setOpenBranchId(branchId);

    try {
      // ✅ GET BRANCH NAME
      const branchRef = doc(db, 'branches', branchId);
      const branchSnap = await getDoc(branchRef);

      if (branchSnap.exists()) {
        setBranchName(branchSnap.data().name || branchId);
      } else {
        setBranchName(branchId);
      }

      // ✅ GET STUDENTS
      const studentsRef = collection(db, 'branches', branchId, 'students');
      const snapshot = await getDocs(studentsRef);

      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setBranchData(list);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">
        Branch Invitations
      </h1>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="space-y-6">
        {branches.map((branch) => (
          <div key={branch.id} className="bg-white/10 p-4 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-2">
              {branch.name}
            </h2>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1">
                <label className="block text-white/70 text-sm mb-1">
                  Password
                </label>
                <input
                  type="text"
                  value={passwords[branch.id] || ''}
                  onChange={(e) =>
                    handlePasswordChange(branch.id, e.target.value)
                  }
                  className="w-full px-3 py-2 bg-white/20 rounded text-white border border-white/20"
                  placeholder="Set branch password"
                />
              </div>

              {/* GENERATE LINK */}
              <button
                onClick={() => handleGenerate(branch.id)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
              >
                Generate Invitation
              </button>

              {/* OPEN DASHBOARD */}
              <button
                onClick={() => openDashboard(branch.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Open Dashboard
              </button>
            </div>

            {/* SHOW LINK */}
            {invitationLinks[branch.id] && (
              <div className="mt-3">
                <p className="text-white/70 text-sm">Invitation link:</p>

                <code className="block bg-black/30 p-2 rounded break-all text-sm text-white">
                  {invitationLinks[branch.id]}
                </code>

                <p className="text-yellow-300 text-sm mt-1">
                  Password: {passwords[branch.id]}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* =========================
          POPUP DASHBOARD
      ========================= */}
      {openBranchId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              backgroundColor: '#ff2d2d',
              padding: '20px',
              borderRadius: '10px',
              width: '80%',
              maxHeight: '80%',
              overflowY: 'auto',
              color: 'white',
            }}
          >
            {/* CLOSE */}
            <button
              onClick={() => setOpenBranchId(null)}
              style={{
                float: 'right',
                background: 'black',
                color: 'white',
                padding: '5px 10px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Close
            </button>

            {/* TITLE */}
            <h2 style={{ marginBottom: '20px' }}>
              ✅ Branch Dashboard: {branchName}
            </h2>

            {/* STUDENTS */}
            {branchData.length === 0 ? (
              <p>No students found</p>
            ) : (
              branchData.map((student) => {
                const paid = student.feePaid || 0;
                const balance = TOTAL_FEE - paid;

                return (
                  <div
                    key={student.id}
                    style={{
                      border: '1px solid white',
                      padding: '10px',
                      marginBottom: '10px',
                      borderRadius: '5px',
                    }}
                  >
                    <p><strong>Name:</strong> {student.name}</p>
                    <p><strong>Account Number:</strong> {student.id}</p>
                    <p><strong>Paid:</strong> Ksh {paid}</p>
                    <p><strong>Balance:</strong> Ksh {balance > 0 ? balance : 0}</p>
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