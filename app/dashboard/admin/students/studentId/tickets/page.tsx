'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function GenerateTicketPage({ params }: { params: { studentId: string } }) {
  const { studentId } = params;
  const [instructors, setInstructors] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      // First get student to know branch
      const studentDoc = await getDocs(query(collection(db, 'students'), where('id', '==', studentId)));
      if (studentDoc.empty) return;
      const branchId = studentDoc.docs[0].data().branchId;

      const instrQuery = query(collection(db, 'instructors'), where('branchId', '==', branchId), where('isActive', '==', true));
      const instrSnap = await getDocs(instrQuery);
      setInstructors(instrSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const vehQuery = query(collection(db, 'vehicles'), where('branchId', '==', branchId), where('isAvailable', '==', true));
      const vehSnap = await getDocs(vehQuery);
      setVehicles(vehSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, [studentId]);

  const handleGenerate = async () => {
    if (!selectedInstructor || !selectedVehicle) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'lessonTickets'), {
        studentId,
        instructorId: selectedInstructor,
        vehicleId: selectedVehicle,
        date: new Date(),
        duration: 1,
        status: 'scheduled',
        generatedVia: 'portal'
      });
      // Optionally increment lessonsTaken?
      router.push(`/dashboard/student/${studentId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Generate Lesson Ticket</h1>
      <div className="bg-white p-4 rounded shadow max-w-md">
        <div className="mb-4">
          <label className="block mb-1">Select Instructor</label>
          <select
            value={selectedInstructor}
            onChange={e => setSelectedInstructor(e.target.value)}
            className="w-full border p-2"
          >
            <option value="">-- Choose --</option>
            {instructors.map(i => (
              <option key={i.id} value={i.id}>{i.name} ({i.code})</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block mb-1">Select Vehicle</label>
          <select
            value={selectedVehicle}
            onChange={e => setSelectedVehicle(e.target.value)}
            className="w-full border p-2"
          >
            <option value="">-- Choose --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.registration} - {v.model}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Ticket'}
        </button>
      </div>
    </div>
  );
}