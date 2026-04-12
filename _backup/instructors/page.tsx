"use client";
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// ... rest of the code

interface Instructor {
  id: string;
  name: string;
  code: string;
  phone: string;
  branchId: string;
  isActive: boolean;
}

export default function InstructorsPage({ params }: { params: { branchId: string } }) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInstructors() {
      try {
        const q = query(collection(db, 'instructors'), where('branchId', '==', params.branchId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInstructors(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchInstructors();
  }, [params.branchId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Instructors</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Phone</th>
              <th>Branch</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map(i => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.code}</td>
                <td>{i.phone}</td>
                <td>{i.branchId}</td>
                <td>{i.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
