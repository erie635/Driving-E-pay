import { NextResponse } from 'next/server';
import AfricasTalking from 'africastalking';

const credentials = {
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
};

const africastalking = AfricasTalking(credentials);
const sms = africastalking.SMS;

export async function POST(request) {
  try {
    const { phoneNumbers, message } = await request.json();
    console.log('📥 Received request:', { phoneNumbers, message });

    if (!phoneNumbers || !phoneNumbers.length || !message) {
      return NextResponse.json(
        { error: 'Phone numbers and message are required.' },
        { status: 400 }
      );
    }

    const senderId = process.env.AT_SENDER_ID;
    console.log('🔑 Sender ID:', senderId);
    
    if (!senderId) {
      return NextResponse.json(
        { error: 'Sender ID not configured.' },
        { status: 500 }
      );
    }

    // ✅ FIX: Format phone numbers to international format without duplication
    const formattedNumbers = phoneNumbers.map(number => {
      // Remove all non-digit characters (including '+', spaces, dashes)
      let digits = number.replace(/\D/g, '');
      
      // If number starts with '0' (local Kenyan format), replace with '+254'
      if (digits.startsWith('0')) {
        digits = '254' + digits.substring(1);
      }
      // If number already has '254' prefix, keep as is
      // If number is less than 12 digits, assume missing country code? Better to assume Kenyan.
      // Ensure it starts with '254' then add '+'
      if (!digits.startsWith('254')) {
        digits = '254' + digits;
      }
      return '+' + digits;
    });
    console.log('📞 Formatted numbers:', formattedNumbers);

    // ✅ FIX: For sandbox, use 'sandbox' as sender ID – but if that fails, try a generic name
    // The error "InvalidSenderId" suggests the sandbox might require a different format.
    // Let's use a safe alphanumeric sender ID (max 11 chars, no spaces)
    let effectiveSenderId = senderId;
    if (senderId === 'sandbox') {
      // Some sandbox accounts accept 'sandbox', but if not, try 'INFO' or 'TEST'
      effectiveSenderId = 'INFO'; // Change to any 4-11 character alphanumeric
    }

    const response = await sms.send({
      to: formattedNumbers,
      message: message,
      from: effectiveSenderId,
      enqueue: true,
    });
    
    console.log('📡 Full AT response:', JSON.stringify(response, null, 2));

    if (!response || !response.SMSMessageData || !response.SMSMessageData.Recipients) {
      console.error('❌ Unexpected response structure:', response);
      return NextResponse.json(
        { error: 'Invalid response from Africa\'s Talking' },
        { status: 500 }
      );
    }

    const recipients = response.SMSMessageData.Recipients;
    const sentCount = recipients.filter(r => r.status === 'Success').length;
    const errors = recipients
      .filter(r => r.status !== 'Success')
      .map(r => `${r.number}: ${r.status}${r.cost ? ` (cost: ${r.cost})` : ''}`);

    console.log(`✅ Sent: ${sentCount}/${phoneNumbers.length}, Errors:`, errors);

    return NextResponse.json({
      sent: sentCount,
      total: phoneNumbers.length,
      errors: errors,
    });
  } catch (error) {
    console.error('🔥 Africa\'s Talking API Error:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}