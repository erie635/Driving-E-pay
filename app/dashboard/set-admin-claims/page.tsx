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

// Password from environment variable
const REQUIRED_PASSWORD = process.env.NEXT_PUBLIC_SCHOOL_FEE_PASSWORD || "admin123";

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
// --- Render password prompt if not authenticated ---
if (!isAuthenticated) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        {/* Logo added here */}
        <img
          src="/logopds.jpg"
          alt="Logo"
          className="mx-auto mb-4 w-24 h-24 object-contain"
        />
        <h2 className="text-2xl text-black font-bold mb-4 text-center">Admin Access To Adjust School Fee</h2>
        <form onSubmit={handlePasswordSubmit}>
          <input
            type="password"
            placeholder="Enter password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full text-black p-2 border rounded mb-4"
            autoFocus
          />
          {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

  // --- Authenticated view: original content with reduced font size ---
  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div style={styles.container}>
        <h1 style={styles.title}>Add Student</h1>

        {/* Fee Management Section */}
        <div style={styles.feeManagement}>
          <h3 style={styles.subtitle}>Manage Class Fees (Market Prices)</h3>
          <div style={styles.feeGrid}>
            {classOptions.map(cls => (
              <div key={cls} style={styles.feeItem}>
                <span style={styles.feeLabel}>{cls}:</span>
                {editingFee === cls ? (
                  <div style={styles.feeEdit}>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={styles.feeInput}
                      autoFocus
                    />
                    <button onClick={() => saveFee(cls)} style={styles.feeSaveBtn}>Save</button>
                    <button onClick={() => setEditingFee(null)} style={styles.feeCancelBtn}>Cancel</button>
                  </div>
                ) : (
                  <div style={styles.feeDisplay}>
                    <span>Ksh {fees[cls]}</span>
                    <button onClick={() => startEditFee(cls)} style={styles.feeEditBtn}>Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={styles.feeNote}>* Changes will apply to new students. Existing students' fees remain unchanged.</p>
        </div>

        {/* Branch Selector */}
        <div style={styles.selectContainer}>
          <label style={styles.label}>Select Branch:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            style={styles.select}
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
        <form onSubmit={addStudent} style={styles.form}>
          <input
            type="text"
            placeholder="Student Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={styles.input}
          />
          <input
            type="email"
            placeholder="Student Email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
            style={styles.input}
          />
          <input
            type="text"
            placeholder="ID Number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            style={styles.input}
          />
          <input
            type="number"
            placeholder="Fee Paid (Ksh)"
            value={feePaid}
            onChange={(e) => setFeePaid(e.target.value)}
            style={styles.input}
          />

          {/* Class selection with dynamic fee display */}
          <div style={styles.classContainer}>
            <label style={styles.label}>Classes Enrolled:</label>
            <div style={styles.checkboxGroup}>
              {classOptions.map(cls => (
                <label key={cls} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    value={cls}
                    checked={selectedClasses.includes(cls)}
                    onChange={() => toggleClass(cls)}
                    style={styles.checkbox}
                  />
                  {cls} (Ksh {fees[cls]})
                </label>
              ))}
            </div>
            {selectedClasses.length > 0 && (
              <p style={styles.totalFeeHint}>
                Total Fee: Ksh {computeTotalFee(selectedClasses)}
              </p>
            )}
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Adding...' : 'Add Student'}
          </button>
        </form>

        {/* Students List */}
        {selectedBranchId && (
          <div style={styles.listContainer}>
            <h2 style={styles.subtitle}>Students</h2>
            {students.length === 0 ? (
              <p>No students found</p>
            ) : (
              students.map((student) => {
                const totalFee = student.totalFee || 0;
                const paid = student.feePaid || 0;
                const balance = totalFee - paid;
                const classList = student.classes?.join(', ') || 'None';
                return (
                  <div key={student.id} style={styles.card}>
                    <p><strong>Admission No:</strong> {student.accountNumber || student.studentAccountId}</p>
                    <p><strong>Name:</strong> {student.name}</p>
                    <p><strong>Email:</strong> {student.email}</p>
                    <p><strong>Phone:</strong> {student.phone}</p>
                    <p><strong>ID Number:</strong> {student.idNumber}</p>
                    <p><strong>Class(es):</strong> {classList}</p>
                    <p><strong>Total Fee:</strong> Ksh {totalFee}</p>
                    <p><strong>Amount Paid:</strong> Ksh {paid}</p>
                    <p style={{ fontWeight: 'bold', color: balance <= 0 ? 'green' : 'orange' }}>
                      <strong>Balance:</strong> Ksh {balance > 0 ? balance : 0}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Styles (unchanged)
const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '20px' },
  title: { fontSize: '22px', marginBottom: '15px' },
  selectContainer: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '5px' },
  select: { padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', maxWidth: '300px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' },
  input: { padding: '10px', borderRadius: '5px', border: '1px solid #ccc' },
  button: { padding: '10px', backgroundColor: '#0a7', color: '#fff ', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  listContainer: { marginTop: '30px' },
  subtitle: { fontSize: '18px', marginBottom: '10px' },
  card: { padding: '10px', border: '1px solid #ddd', borderRadius: '5px', marginTop: '10px' },
  classContainer: { marginTop: '5px' },
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' },
  checkbox: { margin: 0 },
  totalFeeHint: { marginTop: '8px', fontSize: '13px', fontWeight: 'bold', color: '#0a7' },
  feeManagement: { marginBottom: '25px', padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#808067' },
  feeGrid: { display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '10px' },
  feeItem: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  feeLabel: { fontWeight: 'bold', minWidth: '50px' },
  feeDisplay: { display: 'flex', alignItems: 'center', gap: '8px' },
  feeEdit: { display: 'flex', alignItems: 'center', gap: '5px' },
  feeInput: { width: '100px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' },
  feeEditBtn: { padding: '2px 8px', backgroundColor: '#2196F3', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  feeSaveBtn: { padding: '2px 8px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  feeCancelBtn: { padding: '2px 8px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  feeNote: { fontSize: '12px', color: '#666', marginTop: '10px' },
};