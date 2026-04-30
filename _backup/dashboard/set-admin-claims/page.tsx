'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

// Default fallback fees (used only if no document exists)
const DEFAULT_FEES: Record<string, number> = {
  'B1/B2': 15000,
  'C1': 18500,
  'A1': 7500,
  'A2': 7500,
  'A3': 7500,
};

// =====================================================
// 🔐 INTERNAL PASSWORD (hardcoded) – change as needed
// =====================================================
const REQUIRED_PASSWORD = "1234";

export default function BranchStudentPage() {
  // --- Password protection state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- Original state variables ---
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [feePaid, setFeePaid] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);

  // Dynamic fees state
  const [fees, setFees] = useState<Record<string, number>>(DEFAULT_FEES);
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const classOptions = ['B1/B2', 'C1', 'A1', 'A2', 'A3'];

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

  // ✅ Fetch fees from Firestore (real‑time)
  useEffect(() => {
    const feesDocRef = doc(db, 'settings', 'classFees');
    const unsubscribe = onSnapshot(feesDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setFees(docSnap.data() as Record<string, number>);
      } else {
        // Create default fees document if it doesn't exist
        setDoc(feesDocRef, DEFAULT_FEES).catch(console.error);
        setFees(DEFAULT_FEES);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ Fetch branches (real‑time)
  useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const unsubscribe = onSnapshot(branchesRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setBranches(data);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Fetch students for the selected branch (real‑time)
  useEffect(() => {
    if (!selectedBranchId) return;
    const studentsRef = collection(db, 'branches', selectedBranchId, 'students');
    const unsubscribe = onSnapshot(studentsRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setStudents(data);
    });
    return () => unsubscribe();
  }, [selectedBranchId]);

  // ✅ Generate admission number
  const generateAdmissionNumber = (branchName: string) => {
    const firstLetter = branchName.trim().charAt(0).toUpperCase();
    const schoolCode = "HSD";
    const suffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${firstLetter}${schoolCode}-${suffix}`;
  };

  // ✅ Compute total fee from selected classes using dynamic fees
  const computeTotalFee = (classes: string[]) => {
    return classes.reduce((sum, cls) => sum + (fees[cls] || 0), 0);
  };

  // ✅ Add student to Firestore (saves classes & totalFee)
  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBranchId) {
      alert('Please select a branch first');
      return;
    }

    if (!studentName || !studentEmail || !studentPhone || !idNumber) {
      alert('Please fill all fields');
      return;
    }

    if (selectedClasses.length === 0) {
      alert('Please select at least one class');
      return;
    }

    try {
      setLoading(true);

      const selectedBranch = branches.find(b => b.id === selectedBranchId);
      const branchName = selectedBranch?.name || 'Unknown';
      const admissionNumber = generateAdmissionNumber(branchName);
      const totalFee = computeTotalFee(selectedClasses);
      const paidAmount = Number(feePaid) || 0;

      const studentsRef = collection(db, 'branches', selectedBranchId, 'students');

      await addDoc(studentsRef, {
        classes: selectedClasses,
        totalFee: totalFee,
        accountNumber: admissionNumber,
        studentAccountId: admissionNumber,
        name: studentName,
        email: studentEmail,
        phone: studentPhone,
        idNumber: idNumber,
        feePaid: paidAmount,
        branchId: selectedBranchId,
        createdAt: new Date(),
      });

      alert(`Student added successfully!\nAdmission No: ${admissionNumber}\nTotal Fee: Ksh ${totalFee}`);

      // Clear form
      setStudentName('');
      setStudentEmail('');
      setStudentPhone('');
      setIdNumber('');
      setFeePaid('');
      setSelectedClasses([]);
    } catch (error) {
      console.error(error);
      alert('Error adding student');
    } finally {
      setLoading(false);
    }
  };

  const toggleClass = (cls: string) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  // ✅ Fee editing handlers
  const startEditFee = (cls: string) => {
    setEditingFee(cls);
    setEditValue(fees[cls].toString());
  };

  const saveFee = async (cls: string) => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      alert('Please enter a valid positive number');
      return;
    }
    const updatedFees = { ...fees, [cls]: newValue };
    setFees(updatedFees);
    setEditingFee(null);

    // Save to Firestore
    const feesDocRef = doc(db, 'settings', 'classFees');
    try {
      await setDoc(feesDocRef, updatedFees);
      alert(`Fee for ${cls} updated to Ksh ${newValue}`);
    } catch (err) {
      console.error(err);
      alert('Failed to update fee in database');
    }
  };

  // --- Render password prompt if not authenticated ---
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          /* Password screen responsive + small fonts */
          .flex.items-center.justify-center.min-h-screen.bg-gray-100.p-4 {
            min-height: 100vh;
            background-color: #f3f4f6;
            padding: 1rem;
          }
          .bg-white.p-6.sm\\:p-8.rounded-lg.shadow-md.w-full.max-w-sm.sm\\:w-96 {
            background-color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 24rem;
          }
          .mx-auto.mb-4.w-20.h-20.sm\\:w-24.sm\\:h-24.object-contain {
            width: 4rem;
            height: 4rem;
            margin-bottom: 1rem;
          }
          .text-xl.sm\\:text-2xl.text-black.font-bold.mb-4.text-center {
            font-size: 1.2rem;
            color: black;
            margin-bottom: 0.75rem;
          }
          input[type="password"] {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ccc;
            border-radius: 0.25rem;
            font-size: 0.8rem;
          }
          .text-red-500.text-xs.sm\\:text-sm.mb-4 {
            font-size: 0.7rem;
          }
          .bg-indigo-600.text-white.py-2.rounded.hover\\:bg-indigo-700 {
            background-color: #4f46e5;
            padding: 0.5rem;
            font-size: 0.8rem;
          }
          @media (min-width: 640px) {
            .bg-white.p-6.sm\\:p-8.rounded-lg.shadow-md.w-full.max-w-sm.sm\\:w-96 {
              padding: 1.5rem;
            }
            .mx-auto.mb-4.w-20.h-20.sm\\:w-24.sm\\:h-24.object-contain {
              width: 5rem;
              height: 5rem;
            }
            .text-xl.sm\\:text-2xl.text-black.font-bold.mb-4.text-center {
              font-size: 1.5rem;
            }
            input[type="password"] {
              font-size: 0.9rem;
            }
            .bg-indigo-600.text-white.py-2.rounded.hover\\:bg-indigo-700 {
              font-size: 0.9rem;
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
              Admin Access To Adjust School Fee
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
              {passwordError && <p className="text-red-500 text-xs sm:text-sm mb-4">{passwordError}</p>}
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

  // --- Authenticated view with embedded CSS overrides for responsive + small fonts ---
  return (
    <>
      <style>{`
        /* Override Tailwind classes for the entire component */
        .p-4.sm\\:p-6.max-w-6xl.mx-auto.text-sm.sm\\:text-base {
          padding: 0.75rem !important;
          max-width: 72rem;
          margin-left: auto;
          margin-right: auto;
          font-size: 0.75rem !important;
        }
        @media (min-width: 640px) {
          .p-4.sm\\:p-6.max-w-6xl.mx-auto.text-sm.sm\\:text-base {
            padding: 1rem !important;
            font-size: 0.85rem !important;
          }
        }

        /* Title */
        .text-xl.sm\\:text-2xl.font-bold.mb-4.sm\\:mb-6 {
          font-size: 1.2rem !important;
          margin-bottom: 0.75rem !important;
        }
        @media (min-width: 640px) {
          .text-xl.sm\\:text-2xl.font-bold.mb-4.sm\\:mb-6 {
            font-size: 1.4rem !important;
            margin-bottom: 1rem !important;
          }
        }

        /* Fee management section */
        .mb-6.p-4.border.rounded-lg.bg-gray-50 {
          padding: 0.75rem !important;
        }
        .text-base.sm\\:text-lg.font-semibold.mb-3 {
          font-size: 0.9rem !important;
        }
        .flex.flex-wrap.gap-3.sm\\:gap-4 > div {
          font-size: 0.7rem !important;
        }
        input[type="number"] {
          font-size: 0.7rem !important;
          padding: 0.2rem 0.4rem !important;
        }
        button.px-2.py-1 {
          font-size: 0.65rem !important;
          padding: 0.2rem 0.5rem !important;
        }
        .text-xs.text-gray-500.mt-2 {
          font-size: 0.6rem !important;
        }

        /* Branch selector */
        .mb-4 select {
          font-size: 0.7rem !important;
          padding: 0.3rem !important;
        }

        /* Form inputs */
        .space-y-3 input, .space-y-3 select {
          font-size: 0.7rem !important;
          padding: 0.3rem 0.5rem !important;
        }
        .space-y-3 button {
          font-size: 0.75rem !important;
          padding: 0.4rem !important;
        }

        /* Class checkboxes */
        .flex.flex-wrap.gap-3 label {
          font-size: 0.7rem !important;
        }
        .text-sm.font-bold.text-green-700.mt-2 {
          font-size: 0.7rem !important;
        }

        /* Students list container */
        .space-y-3.max-h-\\[500px\\].overflow-y-auto > div {
          padding: 0.5rem !important;
          font-size: 0.65rem !important;
        }
        @media (min-width: 640px) {
          .space-y-3.max-h-\\[500px\\].overflow-y-auto > div {
            padding: 0.75rem !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm sm:text-base">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Add Student</h1>

        {/* Fee Management Section */}
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-base sm:text-lg font-semibold mb-3">Manage Class Fees (Market Prices)</h3>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {classOptions.map(cls => (
              <div key={cls} className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base">{cls}:</span>
                {editingFee === cls ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-24 p-1 border rounded text-sm"
                      autoFocus
                    />
                    <button onClick={() => saveFee(cls)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Save</button>
                    <button onClick={() => setEditingFee(null)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Ksh {fees[cls]}</span>
                    <button onClick={() => startEditFee(cls)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">* Changes will apply to new students. Existing students' fees remain unchanged.</p>
        </div>

        {/* Branch Selector */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm sm:text-base mb-1">Select Branch:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full max-w-md p-2 border rounded text-sm sm:text-base"
          >
            <option value="">-- Select Branch --</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name || branch.id}
              </option>
            ))}
          </select>
        </div> 

        {/* Form */}
        <form onSubmit={addStudent} className="space-y-3 max-w-md">
          <input
            type="text"
            placeholder="Student Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full p-2 border rounded text-sm sm:text-base"
          />
          <input
            type="email"
            placeholder="Student Email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            className="w-full p-2 border rounded text-sm sm:text-base"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
            className="w-full p-2 border rounded text-sm sm:text-base"
          />
          <input
            type="text"
            placeholder="ID Number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full p-2 border rounded text-sm sm:text-base"
          />
          <input
            type="number"
            placeholder="Fee Paid (Ksh)"
            value={feePaid}
            onChange={(e) => setFeePaid(e.target.value)}
            className="w-full p-2 border rounded text-sm sm:text-base"
          />

          {/* Class selection with dynamic fee display */}
          <div className="mt-2">
            <label className="block text-gray-700 text-sm sm:text-base mb-1">Classes Enrolled:</label>
            <div className="flex flex-wrap gap-3">
              {classOptions.map(cls => (
                <label key={cls} className="flex items-center gap-1 text-sm sm:text-base">
                  <input
                    type="checkbox"
                    value={cls}
                    checked={selectedClasses.includes(cls)}
                    onChange={() => toggleClass(cls)}
                    className="mr-1"
                  />
                  {cls} (Ksh {fees[cls]})
                </label>
              ))}
            </div>
            {selectedClasses.length > 0 && (
              <p className="text-sm font-bold text-green-700 mt-2">
                Total Fee: Ksh {computeTotalFee(selectedClasses)}
              </p>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 text-white py-2 rounded text-sm sm:text-base disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Student'}
          </button>
        </form>

        {/* Students List */}
        {selectedBranchId && (
          <div className="mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3">Students</h2>
            {students.length === 0 ? (
              <p className="text-gray-500 text-sm">No students found</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {students.map((student) => {
                  const totalFee = student.totalFee || 0;
                  const paid = student.feePaid || 0;
                  const balance = totalFee - paid;
                  const classList = student.classes?.join(', ') || 'None';
                  return (
                    <div key={student.id} className="border p-3 sm:p-4 rounded shadow-sm text-sm sm:text-base">
                      <p><strong>Admission No:</strong> {student.accountNumber || student.studentAccountId}</p>
                      <p><strong>Name:</strong> {student.name}</p>
                      <p><strong>Email:</strong> {student.email}</p>
                      <p><strong>Phone:</strong> {student.phone}</p>
                      <p><strong>ID Number:</strong> {student.idNumber}</p>
                      <p><strong>Class(es):</strong> {classList}</p>
                      <p><strong>Total Fee:</strong> Ksh {totalFee}</p>
                      <p><strong>Amount Paid:</strong> Ksh {paid}</p>
                      <p className={`font-bold ${balance <= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                        <strong>Balance:</strong> Ksh {balance > 0 ? balance : 0}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}