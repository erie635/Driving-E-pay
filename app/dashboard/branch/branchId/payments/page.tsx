'use client';
import { useState } from 'react';
import { useBranch } from '@/lib/hooks/useBranch';
import { DatePicker } from '@/components/ui/DatePicker';
import { PaymentTable } from '@/components/branch/PaymentTable';

export default function BranchPaymentsPage({ params }: { params: { branchId: string } }) {
  const { branchId } = params;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  const { payments, students, loading } = useBranch({ branchId, date: selectedDate, search: searchTerm });

  // Combine payments with student details to show balance etc.

  return (
    <div>
      <h1>Daily Collections - {branchId}</h1>
      <div className="flex gap-4">
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
        <input
          type="text"
          placeholder="Search by name, ID, account"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2"
        />
      </div>
      <PaymentTable payments={payments} students={students} />
    </div>
  );
}
