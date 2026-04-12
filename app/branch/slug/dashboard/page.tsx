import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/admin';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BranchDashboard(props: Props) {
  const { slug } = await props.params;

  // 1. Get session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('branch_session')?.value;
  if (!sessionCookie) {
    redirect('/branch-access?error=no_session');
  }

  let session: { branchId: string; branchSlug: string };
  try {
    session = JSON.parse(sessionCookie);
  } catch {
    redirect('/branch-access?error=invalid_session');
  }

  // 2. Check that the slug matches the one in session
  if (session.branchSlug !== slug) {
    redirect('/unauthorized');
  }

  // 3. Fetch branch details
  const branchSnapshot = await adminDb
    .collection('branches')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (branchSnapshot.empty) {
    redirect('/404');
  }
  const branch = branchSnapshot.docs[0].data();
  const branchId = branchSnapshot.docs[0].id;

  // 4. Fetch students for this branch
  const studentsSnapshot = await adminDb
    .collection('students')
    .where('branchId', '==', branchId)
    .orderBy('enrolledAt', 'desc')
    .get();

  const students = studentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-8">
        {branch.name} – Enrolled Students
      </h1>

      {students.length === 0 ? (
        <p className="text-white/60">No students enrolled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">ID Number</th>
                <th className="text-left py-2">Phone</th>
                <th className="text-left py-2">Enrolled At</th>
               </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-white/10">
                  <td className="py-2">{student.name}</td>
                  <td>{student.idNumber}</td>
                  <td>{student.phone}</td>
                  <td>
                    {student.enrolledAt?.toDate
                      ? new Date(student.enrolledAt.toDate()).toLocaleDateString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}