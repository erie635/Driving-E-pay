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
  'B1/B2': 15000,
  C1: 18500,
  A1: 7500,
  A2: 7500,
  A3: 7500,
};

interface Student {
  id: string;
  name: string;
  feePaid: number;
  accountNumber?: string;
  createdAt?: any;
  classes?: string[];
  totalFee?: number;        // total fee based on enrolled classes
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
          // Create default if not exists (optional)
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
        // ✅ Branch name
        const branchRef = doc(db, 'branches', branchId);
        const branchSnap = await getDoc(branchRef);

        if (branchSnap.exists()) {
          setBranchName(branchSnap.data().name || branchId);
        } else {
          setBranchName(branchId);
        }

        // ✅ Students
        const studentsRef = collection(db, 'branches', branchId, 'students');
        const q = query(studentsRef, where('feePaid', '>', 0));
        const snapshot = await getDocs(q);

        const studentList = snapshot.docs.map((doc) => {
          const data = doc.data();
          const classes = data.classes || [];
          
          // Compute total fee based on enrolled classes and current classFees
          let totalFee = data.totalFee; // if already stored in DB, use it
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

        // --- Date-based calculations (unchanged) ---
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
  }, [branchId, selectedDate, classFees]); // re-run when classFees changes

  if (loading) return <div className="p-4">Loading branch dashboard...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        ✅ Branch Dashboard: {branchName || branchId}
      </h1>

      {/* DATE FILTER */}
      <div className="mb-4">
        <label><strong>Select Date:</strong></label><br />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* TOTALS */}
      <div className="mb-6">
        <p><strong>📅 Daily Collection:</strong> Ksh {dailyTotal}</p>
        <p><strong>📊 Weekly Collection:</strong> Ksh {weeklyTotal}</p>
        <p><strong>📊 Yearly Collection:</strong> Ksh {yearlyTotal}</p>
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        💰 Students Who Have Paid
      </h2>

      {students.length === 0 ? (
        <p className="text-gray-500">
          No students have made any payment yet.
        </p>
      ) : (
        <div className="space-y-4">
          {students.map((student) => {
            const paid = student.feePaid || 0;
            const totalFee = student.totalFee || 0;
            const balance = totalFee - paid;
            const isFullyPaid = balance <= 0;

            return (
              <div key={student.id} className="border p-4 rounded shadow-sm">
                <p><strong>Name:</strong> {student.name}</p>

                <p>
                  <strong>Account Number:</strong>{' '}
                  {student.accountNumber}
                </p>

                {/* ✅ Display classes the student enrolled in */}
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

                <p className={isFullyPaid ? 'text-green-600' : 'text-yellow-500'}>
                  <strong>Remaining Balance:</strong>{' '}
                  Ksh {balance > 0 ? balance : 0}
                </p>

                {isFullyPaid && (
                  <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm mt-1">
                    Fully Paid ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}