'use client';
import { useState } from 'react';
import { useStudent } from '@/lib/hooks/useStudent';
import { InstructorSelect } from '@/components/student/InstructorSelect';
import { VehicleSelect } from '@/components/student/VehicleSelect';

export default function GenerateTicket({ params }: { params: { studentId: string } }) {
  const { student, branchInstructors, branchVehicles } = useStudent(params.studentId);
  const [instructor, setInstructor] = useState('');
  const [vehicle, setVehicle] = useState('');

  const handleGenerate = async () => {
    // Call API to create lesson ticket and update lessonsTaken count
    await fetch('/api/lessons/generate', {
      method: 'POST',
      body: JSON.stringify({ studentId: params.studentId, instructorId: instructor, vehicleId: vehicle })
    });
    // Show success
  };

  return (
    <div>
      <h1>Generate Lesson Ticket</h1>
      <InstructorSelect instructors={branchInstructors} onChange={setInstructor} />
      <VehicleSelect vehicles={branchVehicles} onChange={setVehicle} />
      <button onClick={handleGenerate}>Generate Ticket</button>
    </div>
  );
}
