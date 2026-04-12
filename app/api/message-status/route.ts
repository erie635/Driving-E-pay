import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { sid: string } }
) {
  const { sid } = params;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch message status' },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json({ status: data.status, errorCode: data.error_code, errorMessage: data.error_message });
}