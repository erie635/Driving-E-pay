import { adminDb } from '@/lib/firebase/admin';
import { formatCurrency } from '@/lib/utils/currency';
import Link from 'next/link';

export default async function StudentPage({ params }: { params: { studentId: string } }) {
  const studentDoc = await adminDb.collection('students').doc(params.studentId).get();
  const student = { id: studentDoc.id, ...studentDoc.data() };

  // Get upcoming lessons
  const lessonsSnap = await adminDb.collection('lessonTickets')
    .where('studentId', '==', params.studentId)
    .where('status', '==', 'scheduled')
    .orderBy('date', 'asc')
    .limit(5)
    .get();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome, {student.name}</h1>
      <div className="bg-white p-4 rounded shadow mb-6">
        <p><strong>Balance:</strong> {formatCurrency(student.balance)}</p>
        <p><strong>Lessons Taken:</strong> {student.lessonsTaken} / {student.totalLessons}</p>
        <p><strong>Status:</strong> {student.isFullyPaid ? 'Fully Paid' : 'Partial Payment'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={`/dashboard/student/${params.studentId}/tickets`} className="bg-blue-100 p-4 rounded text-center hover:bg-blue-200">
          Generate Lesson Ticket
        </Link>
        <Link href={`/dashboard/student/${params.studentId}/payments`} className="bg-green-100 p-4 rounded text-center hover:bg-green-200">
          Payment History
        </Link>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-2">Upcoming Lessons</h2>
      {lessonsSnap.empty ? (
        <p>No upcoming lessons.</p>
      ) : (
        <ul className="bg-white rounded shadow">
          {lessonsSnap.docs.map(doc => {
            const lesson = doc.data();
            return (
              <li key={doc.id} className="p-2 border-b">
                {lesson.date.toDate().toLocaleString()} - Instructor: {lesson.instructorId}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}