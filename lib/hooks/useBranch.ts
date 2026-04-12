// lib/hooks/useBranch.ts
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export function useBranch({ branchId, date, search }: { branchId: string; date: Date; search: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch payments for this branch on this date
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('branchId', '==', branchId),
          where('date', '==', date)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        setPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch students for this branch
        const studentsQuery = query(
          collection(db, 'students'),
          where('branchId', '==', branchId)
        );
        const studentsSnap = await getDocs(studentsQuery);
        setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [branchId, date, search]); // search not used in this example, but you can add filtering

  return { payments, students, loading };
}