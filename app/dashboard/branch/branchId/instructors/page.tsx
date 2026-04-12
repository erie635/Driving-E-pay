'use client';
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Instructor } from '@/lib/types';

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [newInstructor, setNewInstructor] = useState({ name: '', code: '', phone: '', branchId: '' });

  useEffect(() => {
    const fetchData = async () => {
      const [instrSnap, branchSnap] = await Promise.all([
        getDocs(collection(db, 'instructors')),
        getDocs(collection(db, 'branches'))
      ]);
      setInstructors(instrSnap.docs.map(d => ({ id: d.id, ...d.data() } as Instructor)));
      setBranches(branchSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newInstructor.name || !newInstructor.branchId) return;
    await addDoc(collection(db, 'instructors'), { ...newInstructor, isActive: true });
    // Refresh
    const snapshot = await getDocs(collection(db, 'instructors'));
    setInstructors(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Instructor)));
    setNewInstructor({ name: '', code: '', phone: '', branchId: '' });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Instructors</h1>
      <div className="mb-4 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Add Instructor</h2>
        <input type="text" placeholder="Name" value={newInstructor.name} onChange={e => setNewInstructor({...newInstructor, name: e.target.value})} className="border p-2 mr-2" />
        <input type="text" placeholder="Code" value={newInstructor.code} onChange={e => setNewInstructor({...newInstructor, code: e.target.value})} className="border p-2 mr-2" />
        <input type="text" placeholder="Phone" value={newInstructor.phone} onChange={e => setNewInstructor({...newInstructor, phone: e.target.value})} className="border p-2 mr-2" />
        <select value={newInstructor.branchId} onChange={e => setNewInstructor({...newInstructor, branchId: e.target.value})} className="border p-2 mr-2">
          <option value="">Select Branch</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </div>
      <table className="min-w-full bg-white">
        <thead>
          <tr><th>Name</th><th>Code</th><th>Phone</th><th>Branch</th><th>Active</th> </>
        </thead>
        <tbody>
          {instructors.map(i => (
            <tr key={i.id}>
              <td>{i.name} </>
              <td>{i.code} </>
              <td>{i.phone} </>
              <td>{i.branchId} </>
              <td>{i.isActive ? 'Yes' : 'No'} </>
             </>
          ))}
        </tbody>
      </table>
    </div>
  );
}