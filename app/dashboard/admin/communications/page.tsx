'use client';
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function CommunicationsPage() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    setSending(true);
    setResult('');
    try {
      // Get all active students (lastActive within 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const q = query(
        collection(db, 'students'),
        where('lastActive', '>=', threeMonthsAgo),
        where('isDormant', '==', false)
      );
      const snapshot = await getDocs(q);
      const phoneNumbers = snapshot.docs
        .map(doc => doc.data().phone)
        .filter((phone): phone is string => Boolean(phone));

      if (phoneNumbers.length === 0) {
        setResult('No active students found.');
        return;
      }

      // Call our API route instead of using Twilio directly
      const res = await fetch('/api/send-bulk-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers, message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS');

      setResult(`SMS sent to ${data.sent} out of ${data.total} students.`);
    } catch (error: any) {
      console.error(error);
      setResult('Failed to send SMS: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Bulk SMS to Active Students</h1>
      <textarea
        rows={4}
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type your message..."
        className="w-full border p-2 mb-4"
      />
      <button
        onClick={handleSend}
        disabled={sending || !message}
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {sending ? 'Sending...' : 'Send SMS'}
      </button>
      {result && <p className="mt-4">{result}</p>}
    </div>
  );
}