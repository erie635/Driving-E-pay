import { NextResponse } from 'next/server';

export async function GET() {
  // Your Firebase logic here
  return NextResponse.json({ branches: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Your Firebase logic here
  return NextResponse.json({ success: true });
}