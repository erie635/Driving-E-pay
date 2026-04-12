// app/api/send-sms/route.ts
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(request: Request) {
  const { to, body } = await request.json();
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  const message = await client.messages.create({ to, body, from: process.env.TWILIO_PHONE });
  return NextResponse.json({ success: true, sid: message.sid });
}