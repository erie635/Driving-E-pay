'use client';
export function PaymentTable({ payments, students }: { payments: any[]; students: any[] }) {
  return (
    <table className="min-w-full bg-white mt-4">
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Amount</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => {
          const student = students.find(s => s.id === payment.studentId);
          return (
            <tr key={payment.id}>
               <td>{student?.name || 'Unknown'}</td>
               <td>{payment.amount}</td>
               <td>{new Date(payment.date).toLocaleDateString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
