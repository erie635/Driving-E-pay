export const dynamic = 'force-dynamic';

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function BranchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');

  useEffect(() => {
    const redirectToBranch = async () => {
      if (!token) return;

      try {
        const q = query(
          collection(db, 'branches'),
          where('token', '==', token)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const branchId = snapshot.docs[0].id;

          // Redirect to branch dashboard
          router.replace(`/dashboard/branch/${branchId}`);
        } else {
          console.log('Invalid token');
        }
      } catch (err) {
        console.error(err);
      }
    };

    redirectToBranch();
  }, [token, router]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Redirecting to branch dashboard...</h2>
    </div>
  );
}
