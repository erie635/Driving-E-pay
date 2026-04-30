'use client';

import { useState } from 'react';

export default function SmsPage() {
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  // 🔁 Changed: Now reads your Africa's Talking Sender ID from environment variables
  const senderId = process.env.NEXT_PUBLIC_AT_SENDER_ID || 'YourBrand';

  const handleSend = async () => {
    if (!phoneNumbers.trim() || !message.trim()) {
      setResult('Please fill in phone numbers and message.');
      return;
    }

    const numbers = phoneNumbers
      .split(/[,\n]/)
      .map(n => n.trim())
      .filter(n => n);

    setSending(true);
    setResult('');

    try {
      const res = await fetch('/api/send-bulk-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers: numbers, message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS');

      setResult(`Sent to ${data.sent} out of ${data.total} numbers.`);
      if (data.errors?.length) {
        setResult(prev => prev + ` Errors: ${data.errors.join(', ')}`);
      }
    } catch (error: any) {
      setResult('Error: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-black mb-6">Send SMS</h1>

      <div className="bg-black/5 backdrop-blur-sm rounded-xl p-6 space-y-4 border border-black/10">
        <div>
          <label className="block text-black/80 text-sm mb-2">From (Sender ID)</label>
          <input
            type="text"
            value={senderId}
            readOnly
            className="w-full px-4 py-2 rounded-lg bg-black/5 border border-black/20 text-black cursor-not-allowed"
          />
          <p className="text-black/50 text-xs mt-1">Your Africa's Talking Sender ID – cannot be changed here.</p>
        </div>

        <div>
          <label className="block text-black/80 text-sm mb-2">To (Recipients)</label>
          <textarea
            rows={4}
            value={phoneNumbers}
            onChange={e => setPhoneNumbers(e.target.value)}
            placeholder="Enter phone numbers, one per line or comma separated&#10;Example:&#10;+1234567890&#10;+9876543210"
            className="w-full px-4 py-2 rounded-lg bg-white border border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-black/80 text-sm mb-2">Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="w-full px-4 py-2 rounded-lg bg-white border border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !phoneNumbers || !message}
          className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send SMS'}
        </button>

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-black/5 border border-black/10 text-black">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}