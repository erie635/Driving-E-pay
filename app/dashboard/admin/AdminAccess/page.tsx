"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";

// Default fallback fees (used only if no document exists)
const DEFAULT_CLASS_FEES: Record<string, number> = {
  'B1/B2': 15000,
  'B1': 15000,
  'BC1': 18500,
  'C1': 14500,
  'D1': 11000,
  'A1': 7500,
  'A2': 7500,
  'A3': 7500,
};

interface Student {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  feePaid: number;
  accountNumber: string;
  createdAt?: any;
  classes?: string[];
  totalFee?: number;
}

// =====================================================
// 🔐 INTERNAL PASSWORD (hardcoded) – change as needed
// =====================================================
const REQUIRED_PASSWORD = "1234";

export default function AdminStudentsPage() {
  // --- Password protection state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- Existing states ---
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("");
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [classFees, setClassFees] = useState<Record<string, number>>(DEFAULT_CLASS_FEES);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    idNumber: "",
    feePaid: "",
    accountNumber: "",
  });
  const [updating, setUpdating] = useState(false);

  // --- Password check handler ---
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
        const feesDocRef = doc(db, 'settings', 'classFees');
        const feesDoc = await getDoc(feesDocRef);
        if (feesDoc.exists()) {
          setClassFees(feesDoc.data() as Record<string, number>);
        }
      } catch (err) {
        console.error('Error fetching class fees:', err);
      }
    };
    fetchClassFees();
  }, []);

  // Fetch all students from all branches (with dynamic total fee)
  useEffect(() => {
    const fetchAllStudents = async () => {
      try {
        setLoading(true);
        const branchesSnap = await getDocs(collection(db, "branches"));
        const branches = branchesSnap.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id,
        }));
        setBranchesList(branches);

        const allStudents: Student[] = [];

        for (const branch of branches) {
          const studentsRef = collection(db, "branches", branch.id, "students");
          const q = query(studentsRef, orderBy("createdAt", "desc"));
          const studentsSnap = await getDocs(q);

          studentsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const classes = data.classes || [];
            let totalFee = data.totalFee;
            if (!totalFee && classes.length) {
              totalFee = classes.reduce((sum, cls) => sum + (classFees[cls] || 0), 0);
            } else if (!totalFee) {
              totalFee = 0;
            }

            allStudents.push({
              id: docSnap.id,
              branchId: branch.id,
              branchName: branch.name,
              name: data.name || "No name",
              email: data.email || "",
              phone: data.phone || "",
              idNumber: data.idNumber || "",
              feePaid: Number(data.feePaid) || 0,
              accountNumber: data.accountNumber || data.studentAccountId || "N/A",
              createdAt: data.createdAt,
              classes: classes,
              totalFee: totalFee,
            });
          });
        }

        setStudents(allStudents);
        setFilteredStudents(allStudents);
      } catch (err) {
        console.error(err);
        setError("Failed to load students.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllStudents();
  }, [classFees]);

  // Filter students by search term and branch
  useEffect(() => {
    let filtered = [...students];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.accountNumber.toLowerCase().includes(term) ||
          s.branchName.toLowerCase().includes(term) ||
          s.idNumber.toLowerCase().includes(term)
      );
    }
    if (selectedBranchFilter) {
      filtered = filtered.filter((s) => s.branchId === selectedBranchFilter);
    }
    setFilteredStudents(filtered);
  }, [searchTerm, selectedBranchFilter, students]);

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      phone: student.phone,
      email: student.email,
      idNumber: student.idNumber,
      feePaid: student.feePaid.toString(),
      accountNumber: student.accountNumber,
    });
  };

  const closeEditModal = () => {
    setEditingStudent(null);
    setEditForm({
      name: "",
      phone: "",
      email: "",
      idNumber: "",
      feePaid: "",
      accountNumber: "",
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const saveStudentUpdate = async () => {
    if (!editingStudent) return;

    try {
      setUpdating(true);
      const studentRef = doc(
        db,
        "branches",
        editingStudent.branchId,
        "students",
        editingStudent.id
      );

      const updatedData = {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        idNumber: editForm.idNumber,
        feePaid: Number(editForm.feePaid) || 0,
        accountNumber: editForm.accountNumber,
      };

      await updateDoc(studentRef, updatedData);

      const updatedStudents = students.map((s) =>
        s.id === editingStudent.id && s.branchId === editingStudent.branchId
          ? { ...s, ...updatedData }
          : s
      );
      setStudents(updatedStudents);
      alert("Student updated successfully!");
      closeEditModal();
    } catch (err) {
      console.error(err);
      alert("Error updating student.");
    } finally {
      setUpdating(false);
    }
  };

  // --- Render password prompt if not authenticated ---
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          /* Password screen - responsive + small fonts */
          .flex.items-center.justify-center.min-h-screen.bg-gray-100 {
            min-height: 100vh;
            background-color: #f3f4f6;
          }
          .bg-white.p-8.rounded-lg.shadow-md.w-96 {
            background-color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            width: 90%;
            max-width: 24rem;
            margin: 1rem;
          }
          .mx-auto.mb-4.w-24.h-24.object-contain {
            width: 4rem;
            height: 4rem;
          }
          .text-2xl.text-black.font-bold.mb-4.text-center {
            font-size: 1.2rem;
            margin-bottom: 0.75rem;
          }
          input[type="password"] {
            font-size: 0.8rem;
            padding: 0.5rem;
          }
          .text-red-500.text-sm.mb-4 {
            font-size: 0.7rem;
          }
          button {
            font-size: 0.8rem;
            padding: 0.5rem;
          }
          @media (min-width: 640px) {
            .bg-white.p-8.rounded-lg.shadow-md.w-96 {
              padding: 1.5rem;
            }
            .mx-auto.mb-4.w-24.h-24.object-contain {
              width: 5rem;
              height: 5rem;
            }
            .text-2xl.text-black.font-bold.mb-4.text-center {
              font-size: 1.5rem;
            }
            input[type="password"] {
              font-size: 0.9rem;
            }
            button {
              font-size: 0.9rem;
            }
          }
        `}</style>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-md w-96">
            <img
              src="/logopds.jpg"
              alt="Logo"
              className="mx-auto mb-4 w-24 h-24 object-contain"
            />
            <h2 className="text-2xl text-black font-bold mb-4 text-center">Missing Transactions Portal</h2>
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
      </>
    );
  }

  // --- Authenticated view with embedded CSS for responsiveness and small fonts ---
  return (
    <>
      <style>{`
        /* Global small fonts and responsive overrides */
        body, .p-6.bg-gray-50.min-h-screen {
          font-size: 12px;
        }
        @media (min-width: 640px) {
          body, .p-6.bg-gray-50.min-h-screen {
            font-size: 14px;
          }
        }

        /* Main container padding adjusted for mobile */
        .p-6 {
          padding: 0.75rem !important;
        }
        @media (min-width: 640px) {
          .p-6 {
            padding: 1.5rem !important;
          }
        }

        /* Title and subtitle */
        .text-3xl.font-bold.text-gray-900.mb-2 {
          font-size: 1.2rem !important;
        }
        .text-gray-600.mb-6 {
          font-size: 0.7rem !important;
          margin-bottom: 0.75rem !important;
        }

        /* Search and filter row */
        .flex.flex-col.md\\:flex-row.gap-4.mb-6 {
          flex-direction: column;
          gap: 0.5rem;
        }
        @media (min-width: 768px) {
          .flex.flex-col.md\\:flex-row.gap-4.mb-6 {
            flex-direction: row;
            gap: 1rem;
          }
        }
        input, select {
          font-size: 0.75rem !important;
          padding: 0.4rem !important;
        }

        /* Table container - horizontal scroll on small screens */
        .overflow-x-auto {
          overflow-x: auto;
          white-space: nowrap;
        }
        table {
          min-width: 800px;
          font-size: 0.7rem;
        }
        @media (min-width: 640px) {
          table {
            font-size: 0.8rem;
          }
        }
        th, td {
          padding: 0.5rem !important;
        }
        th {
          font-size: 0.65rem !important;
        }

        /* Edit button */
        .bg-indigo-600.hover\\:bg-indigo-700.text-white.px-3.py-1.rounded.text-xs {
          font-size: 0.6rem !important;
          padding: 0.2rem 0.6rem !important;
        }

        /* Modal (popup) */
        .fixed.inset-0.bg-black.bg-opacity-50.flex.items-center.justify-center.z-50.p-4 {
          padding: 0.5rem;
        }
        .bg-blue-900.shadow-xl.max-w-md.w-full.p-6 {
          padding: 1rem !important;
          max-width: 90%;
        }
        .text-xl.font-bold.mb-4 {
          font-size: 1rem !important;
        }
        label {
          font-size: 0.7rem !important;
        }
        input, button {
          font-size: 0.7rem !important;
          padding: 0.3rem !important;
        }
        .px-4.py-2 {
          padding: 0.3rem 0.8rem !important;
        }
        @media (min-width: 640px) {
          .bg-blue-900.shadow-xl.max-w-md.w-full.p-6 {
            padding: 1.5rem !important;
            max-width: 28rem;
          }
          label, input, button {
            font-size: 0.8rem !important;
          }
        }
      `}</style>

      <div className="p-6 bg-gray-50 min-h-screen" style={{ fontSize: "0.8rem" }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin – All Students</h1>
        <p className="text-gray-600 mb-6">Edit student details directly in the database.</p>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, admission number, ID number, or branch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded-lg bg-black"
          />
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="p-2 border rounded-lg bg-gray-800"
          >
            <option value="">All Branches</option>
            {branchesList.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Fee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const totalFee = student.totalFee || 0;
                const balance = totalFee - student.feePaid;
                return (
                  <tr key={`${student.branchId}-${student.id}`} className="hover:bg-orange-300">
                    <td className="px-6 py-4 text-sm text-gray-900">{student.accountNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.branchName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.classes?.join(', ') || 'None'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Ksh {totalFee}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Ksh {student.feePaid}</td>
                    <td className="px-6 py-4 text-sm text-orange-600 font-medium">Ksh {balance > 0 ? balance : 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.idNumber}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => openEditModal(student)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-blue-900 shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Edit Student</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Admission Number</label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={editForm.accountNumber}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">ID Number</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={editForm.idNumber}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Fee Paid (Ksh)</label>
                  <input
                    type="number"
                    name="feePaid"
                    value={editForm.feePaid}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStudentUpdate}
                  disabled={updating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}