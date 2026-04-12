import { adminDb } from '@/lib/firebase/admin';
import BranchAccessClient from './BranchAccessClient';

export default async function BranchDetailPage({ params, searchParams }) {
  // ✅ Await params (required in Next.js 15+)
  const resolvedParams = await params;
  const branchId = resolvedParams.id;

  // ✅ Guard against missing ID
  if (!branchId || typeof branchId !== 'string') {
    return <div className="p-6 text-red-600">Invalid or missing branch ID.</div>;
  }

  const branchDoc = await adminDb.collection('branches').doc(branchId).get();
  if (!branchDoc.exists) return <div>Branch not found</div>;
  const branch = { id: branchDoc.id, ...branchDoc.data() };

  // ✅ Await searchParams if you use it
  const search = await searchParams;
  const token = search.token || null;

  // Fetch branch‑specific data (students, etc.)
  const studentsSnapshot = await adminDb.collection('students')
    .where('branchId', '==', branchId)
    .get();
  const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const branchContent = (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white">{branch.name}</h1>
      {/* Your existing UI (students table, etc.) */}
    </div>
  );

  return (
    <BranchAccessClient branch={branch} token={token}>
      {branchContent}
    </BranchAccessClient>
  );
}