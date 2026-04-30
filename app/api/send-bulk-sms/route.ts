import { NextResponse } from 'next/server';
import AfricasTalking from 'africastalking';

// ✅ CRITICAL: prevents execution during build
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const apiKey = process.env.AT_API_KEY;
    const username = process.env.AT_USERNAME;
    const senderId =
      process.env.AT_SENDER_ID || process.env.NEXT_PUBLIC_AT_SENDER_ID;

    if (!apiKey || !username) {
      return NextResponse.json(
        { error: "Missing Africa's Talking credentials" },
        { status: 500 }
      );
    }

    const africastalking = AfricasTalking({
      apiKey,
      username,
    });

    const sms = africastalking.SMS;

    const { phoneNumbers, message } = await request.json();

    console.log('📥 Received request:', { phoneNumbers, message });

    // ✅ YOUR ORIGINAL VALIDATION
    if (!phoneNumbers || !phoneNumbers.length || !message) {
      return NextResponse.json(
        { error: 'Phone numbers and message are required.' },
        { status: 400 }
      );
    }

    if (!senderId) {
      return NextResponse.json(
        { error: 'Sender ID not configured.' },
        { status: 500 }
      );
    }

    // ✅ YOUR NUMBER FORMAT LOGIC
    const formattedNumbers = phoneNumbers.map(number => {
      let digits = number.replace(/\D/g, '');

      if (digits.startsWith('0')) {
        digits = '254' + digits.substring(1);
      }

      if (!digits.startsWith('254')) {
        digits = '254' + digits;
      }

      return '+' + digits;
    });

    console.log('📞 Formatted numbers:', formattedNumbers);

    // ✅ YOUR SANDBOX LOGIC
    let effectiveSenderId = senderId;
    if (senderId === 'sandbox') {
      effectiveSenderId = 'INFO';
    }

    const response = await sms.send({
      to: formattedNumbers,
      message: message,
      from: effectiveSenderId,
      enqueue: true,
    });

    console.log('📡 Full AT response:', JSON.stringify(response, null, 2));

    if (
      !response ||
      !response.SMSMessageData ||
      !response.SMSMessageData.Recipients
    ) {
      return NextResponse.json(
        { error: "Invalid response from Africa's Talking" },
        { status: 500 }
      );
    }

    const recipients = response.SMSMessageData.Recipients;

    const sentCount = recipients.filter(r => r.status === 'Success').length;

    const errors = recipients
      .filter(r => r.status !== 'Success')
      .map(
        r =>
          `${r.number}: ${r.status}${
            r.cost ? ` (cost: ${r.cost})` : ''
          }`
      );

    console.log(`✅ Sent: ${sentCount}/${phoneNumbers.length}`, errors);

    return NextResponse.json({
      sent: sentCount,
      total: phoneNumbers.length,
      errors,
    });

  } catch (error) {
    console.error('🔥 Africa\'s Talking API Error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}