'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  increment,
  setDoc,
  query,
  where,
} from 'firebase/firestore';

const CLASS_FEES: Record<string, number> = {
  'B1/B2': 15000,
  C1: 18500,
  A1: 7500,
  A2: 7500,
  A3: 7500,
};

const TOTAL_LESSONS = 20;
const MAX_LESSONS_PER_DAY = 2;

export default function BranchAccessPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [storedPassword, setStoredPassword] = useState('');
  const [branchId, setBranchId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);

  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0]);
  const [updatingLesson, setUpdatingLesson] = useState(false);

  // Token verification (unchanged)
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }
    const verifyToken = async () => {
      try {
        const inviteRef = doc(db, 'branchInvitations', token);
        const inviteSnap = await getDoc(inviteRef);
        if (!inviteSnap.exists()) {
          setError('Invalid or expired invitation token.');
          setLoading(false);
          return;
        }
        const data = inviteSnap.data();
        setStoredPassword(data.password);
        setBranchId(data.branchId);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to verify invitation.');
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  // Fetch branch data (unchanged)
  useEffect(() => {
    if (!passwordVerified || !branchId) return;
    const fetchBranchData = async () => {
      setLoading(true);
      try {
        const branchRef = doc(db, 'branches', branchId);
        const branchSnap = await getDoc(branchRef);
        setBranchName(branchSnap.exists() ? branchSnap.data().name || branchId : branchId);

        const studentsRef = collection(db, 'branches', branchId, 'students');
        const studentsSnap = await getDocs(studentsRef);
        const studentsList = studentsSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          const classes = data.classes || [];
          let totalFee = data.totalFee;
          if (!totalFee && classes.length) {
            totalFee = classes.reduce((sum, cls) => sum + (CLASS_FEES[cls] || 0), 0);
          }
          const feePaid = Number(data.feePaid) || 0;
          const lessonsCompleted = data.lessonsCompleted ?? 0;
          return {
            id: docSnap.id,
            name: data.name || 'No name',
            accountNumber: data.accountNumber || data.studentAccountId || docSnap.id,
            phone: data.phone || 'N/A',
            idNumber: data.idNumber || 'N/A',
            feePaid,
            totalFee: totalFee || 0,
            balance: (totalFee || 0) - feePaid,
            classes,
            createdAt: data.createdAt,
            lessonsCompleted,
            lessonsRemaining: TOTAL_LESSONS - lessonsCompleted,
          };
        });
        setStudents(studentsList);
        setFilteredStudents(studentsList);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load branch data.');
        setLoading(false);
      }
    };
    fetchBranchData();
  }, [passwordVerified, branchId]);

  // Filter & calculations (unchanged)
  useEffect(() => {
    if (!students.length) return;
    const term = searchTerm.toLowerCase();
    const filtered = students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.phone.toLowerCase().includes(term) ||
        s.idNumber.toLowerCase().includes(term)
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  useEffect(() => {
    if (!students.length) return;
    let collected = 0, debt = 0;
    students.forEach((s) => {
      const regDate = s.createdAt ? new Date(s.createdAt.seconds * 1000) : null;
      const inRange = (!startDate || !regDate || regDate >= new Date(startDate)) &&
                      (!endDate || !regDate || regDate <= new Date(endDate));
      if (inRange) {
        collected += s.feePaid;
        if (s.balance > 0) debt += s.balance;
      }
    });
    setTotalCollected(collected);
    setTotalDebt(debt);
  }, [startDate, endDate, students]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === storedPassword) {
      setPasswordVerified(true);
      setError(null);
    } else {
      setError('Incorrect password. Access denied.');
    }
  };

  const countLessonsOnDate = async (studentId: string, dateStr: string) => {
    const lessonsRef = collection(db, 'branches', branchId, 'students', studentId, 'lessons');
    const q = query(lessonsRef, where('date', '==', dateStr));
    const snapshot = await getDocs(q);
    return snapshot.size;
  };

  const handleAddLesson = async (studentId: string) => {
    if (!addingLessonFor) return;
    try {
      setUpdatingLesson(true);
      const lessonsToday = await countLessonsOnDate(studentId, lessonDate);
      if (lessonsToday >= MAX_LESSONS_PER_DAY) {
        alert(`Maximum ${MAX_LESSONS_PER_DAY} lessons per day allowed. Already recorded ${lessonsToday} lesson(s) on ${lessonDate}.`);
        setAddingLessonFor(null);
        setUpdatingLesson(false);
        return;
      }
      const studentRef = doc(db, 'branches', branchId, 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      const currentCompleted = studentSnap.data()?.lessonsCompleted || 0;
      if (currentCompleted >= TOTAL_LESSONS) {
        alert('All 20 lessons already completed.');
        setAddingLessonFor(null);
        setUpdatingLesson(false);
        return;
      }
      await updateDoc(studentRef, { lessonsCompleted: increment(1) });
      const lessonTicketRef = doc(db, 'branches', branchId, 'students', studentId, 'lessons', `${lessonDate}_${Date.now()}`);
      await setDoc(lessonTicketRef, {
        date: lessonDate,
        lessonNumber: currentCompleted + 1,
        timestamp: new Date(),
      });
      const updatedStudents = students.map((s) =>
        s.id === studentId
          ? { ...s, lessonsCompleted: currentCompleted + 1, lessonsRemaining: TOTAL_LESSONS - (currentCompleted + 1) }
          : s
      );
      setStudents(updatedStudents);
      alert(`Lesson recorded for ${new Date(lessonDate).toLocaleDateString()}`);
      setAddingLessonFor(null);
      setLessonDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
      alert('Failed to record lesson.');
    } finally {
      setUpdatingLesson(false);
    }
  };

  // Password modal (now light themed)
  if (!passwordVerified) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Branch Access</h1>
          <p className="text-gray-600 text-center mb-6">Enter your password to continue</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              placeholder="Password"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow transition transform hover:scale-[1.02]"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 text-lg">Loading dashboard...</p>
      </div>
    </div>
  );
  if (error) return <div className="min-h-screen bg-white flex items-center justify-center text-red-600 text-xl p-6">{error}</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/logopds.jpg"
              alt="Logo"
              className="h-20 w-auto object-contain"
              fetchPriority="high"
              loading="eager"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Branch Dashboard</h1>
          <p className="text-gray-600 text-lg mt-2">{branchName}</p>
        </div>

        {/* Financial Summary Card - light theme */}
        <div className="bg-white shadow-md rounded-2xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
            Financial Summary
          </h2>
          <div className="flex flex-wrap gap-4 items-end mb-6">
            <div>
              <label className="block text-gray-600 text-sm mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-50 text-gray-800 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-50 text-gray-800 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-green-700 text-sm">Total Collected (in period)</p>
              <p className="text-3xl font-bold text-green-800">Ksh {totalCollected.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-red-700 text-sm">Total Outstanding Debt (in period)</p>
              <p className="text-3xl font-bold text-red-800">Ksh {totalDebt.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-4">* Debt = remaining fee after payments, based on enrolled class(es)</p>
        </div>

        {/* Search - light theme */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, phone, or ID number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Student List - light theme */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-gray-500 text-lg">No students found</p>
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div key={student.id} className="bg-white shadow-sm rounded-2xl border border-gray-200 hover:shadow-md transition-all duration-300 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-gray-700">
                  <div><span className="font-semibold text-purple-700">Name:</span> {student.name}</div>
                  <div><span className="font-semibold text-purple-700">Admission No:</span> {student.accountNumber}</div>
                  <div><span className="font-semibold text-purple-700">Phone:</span> {student.phone}</div>
                  <div><span className="font-semibold text-purple-700">ID Number:</span> {student.idNumber}</div>
                  <div><span className="font-semibold text-purple-700">Class(es):</span> {student.classes?.join(', ') || 'None'}</div>
                  <div><span className="font-semibold text-purple-700">Total Fee:</span> Ksh {student.totalFee.toLocaleString()}</div>
                  <div><span className="font-semibold text-purple-700">Fee Paid:</span> Ksh {student.feePaid.toLocaleString()}</div>
                  <div className={student.balance <= 0 ? 'text-green-600' : 'text-orange-600'}>
                    <span className="font-semibold">Balance:</span> Ksh {student.balance > 0 ? student.balance.toLocaleString() : 0}
                  </div>
                  <div><span className="font-semibold text-purple-700">Reg. Date:</span> {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</div>
                  <div><span className="font-semibold text-purple-700">Lessons:</span> {student.lessonsCompleted} / {TOTAL_LESSONS}</div>
                </div>

                {/* Lesson recording - light theme */}
                {student.lessonsRemaining > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    {addingLessonFor === student.id ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="date"
                          value={lessonDate}
                          onChange={(e) => setLessonDate(e.target.value)}
                          className="bg-gray-50 text-gray-800 p-1 rounded text-sm border border-gray-300"
                        />
                        <button
                          onClick={() => handleAddLesson(student.id)}
                          disabled={updatingLesson}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition"
                        >
                          Confirm Lesson
                        </button>
                        <button
                          onClick={() => setAddingLessonFor(null)}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingLessonFor(student.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Record Lesson
                      </button>
                    )}
                  </div>
                )}
                {student.lessonsRemaining === 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-green-600 text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      All 20 lessons completed
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Custom scrollbar styling (kept, but now with light colors) */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c084fc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a855f7;
        }
      `}</style>
    </div>
  );
}