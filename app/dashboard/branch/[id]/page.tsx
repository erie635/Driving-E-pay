'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { db } from '@/lib/firebase/client';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

// Default fallback fees (used only if no document exists)
const DEFAULT_CLASS_FEES: Record<string, number> = {
  "B1/B2": 15000,
  "B1": 15000,
  "BC1": 18500,
  "C1": 14500,
  "D1": 11000,
  "A1": 7500,
  "A2": 7500,
  "A3": 7500
};

interface Student {
  id: string;
  name: string;
  feePaid: number;
  accountNumber?: string;
  createdAt?: any;
  classes?: string[];
  totalFee?: number;
}

export default function BranchDashboard({ params }) {
  const resolvedParams = use(params);
  const branchId = resolvedParams.id;

  const [students, setStudents] = useState<Student[]>([]);
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDate, setSelectedDate] = useState('');
  const [dailyTotal, setDailyTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  const [classFees, setClassFees] = useState<Record<string, number>>(DEFAULT_CLASS_FEES);

  // Fetch class fees from Firestore (settings/classFees)
  useEffect(() => {
    const fetchClassFees = async () => {
      try {
        const feesDocRef = doc(db, 'settings', 'classFees');
        const feesDoc = await getDoc(feesDocRef);
        if (feesDoc.exists()) {
          setClassFees(feesDoc.data() as Record<string, number>);
        } else {
          console.log('No class fees document found, using defaults');
        }
      } catch (err) {
        console.error('Error fetching class fees:', err);
      }
    };
    fetchClassFees();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchRef = doc(db, 'branches', branchId);
        const branchSnap = await getDoc(branchRef);

        if (branchSnap.exists()) {
          setBranchName(branchSnap.data().name || branchId);
        } else {
          setBranchName(branchId);
        }

        const studentsRef = collection(db, 'branches', branchId, 'students');
        const q = query(studentsRef, where('feePaid', '>', 0));
        const snapshot = await getDocs(q);

        const studentList = snapshot.docs.map((doc) => {
          const data = doc.data();
          const classes = data.classes || [];
          
          let totalFee = data.totalFee;
          if (!totalFee && classes.length) {
            totalFee = classes.reduce((sum, cls) => sum + (classFees[cls] || 0), 0);
          } else if (!totalFee) {
            totalFee = 0;
          }

          return {
            id: doc.id,
            ...data,
            accountNumber: data.accountNumber || doc.id,
            feePaid: Number(data.feePaid) || 0,
            classes: classes,
            totalFee: totalFee,
          };
        }) as Student[];

        setStudents(studentList);

        const today = new Date().toISOString().split('T')[0];
        const referenceDate = selectedDate ? new Date(selectedDate) : new Date();
        if (isNaN(referenceDate.getTime())) {
          setDailyTotal(0);
          setWeeklyTotal(0);
          setYearlyTotal(0);
          return;
        }

        const dailyTarget = selectedDate || today;

        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const targetYear = referenceDate.getFullYear();

        let daily = 0;
        let weekly = 0;
        let yearly = 0;

        studentList.forEach((s) => {
          const paid = s.feePaid || 0;
          if (!s.createdAt) return;

          let dateObj;
          if (s.createdAt?.seconds) {
            dateObj = new Date(s.createdAt.seconds * 1000);
          } else {
            dateObj = new Date(s.createdAt);
          }

          if (isNaN(dateObj.getTime())) return;

          const dateStr = dateObj.toISOString().split('T')[0];

          if (dateStr === dailyTarget) daily += paid;
          if (dateObj >= startOfWeek && dateObj <= endOfWeek) weekly += paid;
          if (dateObj.getFullYear() === targetYear) yearly += paid;
        });

        setDailyTotal(daily);
        setWeeklyTotal(weekly);
        setYearlyTotal(yearly);
      } catch (err) {
        console.error(err);
        setError('Could not load paid students');
      } finally {
        setLoading(false);
      }
    };

    if (branchId) {
      fetchData();
    }
  }, [branchId, selectedDate, classFees]);

  if (loading) return <div className="p-4 text-sm">Loading branch dashboard...</div>;
  if (error) return <div className="p-4 text-red-600 text-sm">{error}</div>;

  return (
    <>
      <style>{`
        /* Override Tailwind classes – responsive, small fonts */
        .p-4.sm\\:p-6 {
          padding: 0.75rem !important;
        }
        @media (min-width: 640px) {
          .p-4.sm\\:p-6 {
            padding: 1rem !important;
          }
        }

        .text-xl.sm\\:text-2xl.font-bold.mb-3.sm\\:mb-4 {
          font-size: 1.25rem !important;
          margin-bottom: 0.5rem !important;
        }
        @media (min-width: 640px) {
          .text-xl.sm\\:text-2xl.font-bold.mb-3.sm\\:mb-4 {
            font-size: 1.4rem !important;
            margin-bottom: 0.75rem !important;
          }
        }

        .mb-4 label {
          font-size: 0.8rem !important;
        }
        input[type="date"] {
          font-size: 0.75rem !important;
          padding: 0.3rem 0.5rem !important;
        }
        @media (min-width: 640px) {
          .mb-4 label {
            font-size: 0.9rem !important;
          }
          input[type="date"] {
            font-size: 0.85rem !important;
            padding: 0.4rem 0.75rem !important;
          }
        }

        .mb-5.sm\\:mb-6.space-y-1.text-sm.sm\\:text-base p {
          font-size: 0.75rem !important;
          margin-bottom: 0.2rem !important;
        }
        @media (min-width: 640px) {
          .mb-5.sm\\:mb-6.space-y-1.text-sm.sm\\:text-base p {
            font-size: 0.85rem !important;
          }
        }

        .text-lg.sm\\:text-xl.font-semibold.mt-5.sm\\:mt-6.mb-2.sm\\:mb-3 {
          font-size: 1rem !important;
          margin-top: 1rem !important;
        }
        @media (min-width: 640px) {
          .text-lg.sm\\:text-xl.font-semibold.mt-5.sm\\:mt-6.mb-2.sm\\:mb-3 {
            font-size: 1.125rem !important;
            margin-top: 1.25rem !important;
          }
        }

        .space-y-3.sm\\:space-y-4 > div {
          border: 1px solid #e5e7eb !important;
          padding: 0.5rem !important;
          border-radius: 0.25rem !important;
        }
        @media (min-width: 640px) {
          .space-y-3.sm\\:space-y-4 > div {
            padding: 0.75rem !important;
          }
        }

        .border.p-3.sm\\:p-4.rounded.shadow-sm.text-sm.sm\\:text-base p {
          font-size: 0.7rem !important;
          margin-bottom: 0.25rem !important;
        }
        @media (min-width: 640px) {
          .border.p-3.sm\\:p-4.rounded.shadow-sm.text-sm.sm\\:text-base p {
            font-size: 0.8rem !important;
          }
        }

        span.inline-block.bg-green-100.text-green-800.px-2.py-1.rounded.text-xs.sm\\:text-sm.mt-1 {
          font-size: 0.6rem !important;
          padding: 0.2rem 0.5rem !important;
        }
        @media (min-width: 640px) {
          span.inline-block.bg-green-100.text-green-800.px-2.py-1.rounded.text-xs.sm\\:text-sm.mt-1 {
            font-size: 0.7rem !important;
          }
        }

        .p-4.text-sm, .p-4.text-red-600.text-sm {
          font-size: 0.75rem !important;
          padding: 0.75rem !important;
        }
      `}</style>

      {/* Main container: force dark text on white background for full visibility */}
      <div className="p-4 sm:p-6" style={{ backgroundColor: 'white', color: '#111827' }}>
        <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
          ✅ Branch Dashboard: {branchName || branchId}
        </h1>

        {/* DATE FILTER */}
        <div className="mb-4">
          <label className="text-sm sm:text-base"><strong>Select Date:</strong></label><br />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border p-1.5 sm:p-2 rounded text-sm sm:text-base"
          />
        </div>

        {/* TOTALS */}
        <div className="mb-5 sm:mb-6 space-y-1 text-sm sm:text-base">
          <p><strong>📅 Daily Collection:</strong> Ksh {dailyTotal}</p>
          <p><strong>📊 Weekly Collection:</strong> Ksh {weeklyTotal}</p>
          <p><strong>📊 Yearly Collection:</strong> Ksh {yearlyTotal}</p>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold mt-5 sm:mt-6 mb-2 sm:mb-3">
          💰 Students Who Have Paid
        </h2>

        {students.length === 0 ? (
          <p className="text-gray-500 text-sm sm:text-base" style={{ color: '#4b5563' }}>
            No students have made any payment yet.
          </p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {students.map((student) => {
              const paid = student.feePaid || 0;
              const totalFee = student.totalFee || 0;
              const balance = totalFee - paid;
              const isFullyPaid = balance <= 0;

              return (
                <div key={student.id} className="border p-3 sm:p-4 rounded shadow-sm text-sm sm:text-base">
                  <p><strong>Name:</strong> {student.name}</p>
                  <p>
                    <strong>Account Number:</strong>{' '}
                    {student.accountNumber}
                  </p>
                  <p>
                    <strong>Classes Enrolled:</strong>{' '}
                    {student.classes && student.classes.length > 0
                      ? student.classes.join(', ')
                      : 'Not specified'}
                  </p>
                  <p>
                    <strong>Total Fee (based on classes):</strong> Ksh {totalFee}
                  </p>
                  <p>
                    <strong>Paid Amount:</strong> Ksh {paid}
                  </p>
                  {/* Ensure remaining balance text is readable: dark green or dark amber */}
                  <p
                    className={isFullyPaid ? 'text-green-600' : 'text-yellow-500'}
                    style={{ color: isFullyPaid ? '#15803d' : '#b45309' }}
                  >
                    <strong>Remaining Balance:</strong>{' '}
                    Ksh {balance > 0 ? balance : 0}
                  </p>
                  {isFullyPaid && (
                    <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs sm:text-sm mt-1">
                      Fully Paid ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}