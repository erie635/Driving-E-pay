'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

export default function BranchAccessPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid access link');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        console.log('[BranchAccess] token:', token);

        // 🔥 Direct fetch using token as ID
        const docRef = doc(db, 'branchInvitations', token);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.log('[BranchAccess] No invitation found');
          setError('Invalid or expired invitation');
        } else {
          console.log('[BranchAccess] Invitation found:', docSnap.data());
          setData(docSnap.data());
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  if (loading) {
    return <p className="text-white p-6">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-400 p-6">{error}</p>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Branch Access</h1>

      <p><strong>Branch ID:</strong> {data.branchId}</p>
      <p><strong>Password:</strong> {data.password}</p>

      {/* 👉 You can now continue login / redirect here */}
    </div>
  );
}