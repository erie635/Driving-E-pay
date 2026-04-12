'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase/client';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const TOTAL_FEE = 18500;

interface Student {
  id: string;
  name: string;
  email: string;
  paidAmount: number;
  branchId: string;
  totalFee: number;
  createdAt: any;
}

interface Branch {
  id: string;
  name: string;
}

export default function StudentManagementPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Admin authentication required');
        setLoading(false);
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      if (!tokenResult.claims.admin) {
        setError('You are not an admin');
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      fetchBranches();
    });
    return () => unsubscribe();
  }, []);

  const fetchBranches = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'branches'));
      if (snapshot.empty) {
        console.warn('No branches found in Firestore');
      }
      const branchList = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.id, // fallback to ID if name missing
      }));
      setBranches(branchList);
      if (branchList.length > 0) setSelectedBranchId(branchList[0].id);
    } catch (err) {
      console.error('Error fetching branches:', err);
      setError('Failed to load branches. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch students when branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'), where('branchId', '==', selectedBranchId));
        const snapshot = await getDocs(q);
        const studentList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[];
        setStudents(studentList);
      } catch (err) {
        setError('Failed to load students');
      }
    };
    fetchStudents();
  }, [selectedBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentEmail.trim()) {
      setError('Name and email are required');
      return;
    }
    const paid = parseFloat(paidAmount);
    if (isNaN(paid) || paid < 0) {
      setError('Please enter a valid paid amount');
      return;
    }

    try {
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), {
          name: studentName.trim(),
          email: studentEmail.trim(),
          paidAmount: paid,
        });
        setEditingStudent(null);
      } else {
        await addDoc(collection(db, 'students'), {
          name: studentName.trim(),
          email: studentEmail.trim(),
          branchId: selectedBranchId,
          paidAmount: paid,
          totalFee: TOTAL_FEE,
          createdAt: new Date(),
        });
      }
      setStudentName('');
      setStudentEmail('');
      setPaidAmount('');
      const q = query(collection(db, 'students'), where('branchId', '==', selectedBranchId));
      const snapshot = await getDocs(q);
      const studentList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[];
      setStudents(studentList);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to save student');
    }
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm('Delete this student permanently?')) return;
    try {
      await deleteDoc(doc(db, 'students', studentId));
      setStudents(students.filter((s) => s.id !== studentId));
    } catch (err) {
      setError('Failed to delete student');
    }
  };

  const startEdit = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.name);
    setStudentEmail(student.email);
    setPaidAmount(student.paidAmount.toString());
  };

  const cancelEdit = () => {
    setEditingStudent(null);
    setStudentName('');
    setStudentEmail('');
    setPaidAmount('');
    setError('');
  };

  const filteredStudents = students.filter((student) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(term) ||
      student.id.toLowerCase().includes(term)
    );
  });

  const handleSearch = () => {
    setSearchTerm(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchTerm('');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🎓 Student Management</h1>

      {/* Branch selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Branch</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="border rounded-lg px-4 py-2 w-64 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        {branches.length === 0 && !loading && (
          <p className="text-red-500 text-sm mt-1">
            ⚠️ No branches loaded. Check Firestore 'branches' collection and security rules.
          </p>
        )}
      </div>

      {/* Add/Edit Form */}
      <div className="bg-blue-500 rounded-xl shadow-md p-6 mb-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">
          {editingStudent ? 'Edit Student' : 'Add New Student'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              className="w-full max-w-md border rounded-lg px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              required
              className="w-full max-w-md border rounded-lg px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="student@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount Paid (₹) – Total Fee: ₹{TOTAL_FEE}
            </label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              required
              min="0"
              step="100"
              className="w-64 border rounded-lg px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., 5000"
            />
            {paidAmount && !isNaN(parseFloat(paidAmount)) && (
              <div className="mt-1 text-sm">
                <span className="text-gray-600">Balance: </span>
                <span className="font-semibold">
                  ₹{Math.max(0, TOTAL_FEE - parseFloat(paidAmount))}
                </span>
              </div>
            )}
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition shadow-sm"
            >
              {editingStudent ? 'Update Student' : 'Add Student'}
            </button>
            {editingStudent && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Student List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold">Existing Students</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border rounded-lg px-4 py-2 w-72 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleSearch}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
            >
              Search
            </button>
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="text-gray-500">
            {students.length === 0
              ? 'No students added yet.'
              : 'No students match your search.'}
          </p>
        ) : (
          <div className="overflow-x-auto bg-blue-500 rounded-xl shadow border border-gray-600">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Paid (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Balance (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const balance = TOTAL_FEE - student.paidAmount;
                  return (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{student.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{student.paidAmount}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₹{balance > 0 ? balance : 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                        <button onClick={() => startEdit(student)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}