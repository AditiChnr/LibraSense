import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set({
    name: 'librasense_session',
    value: '',
    httpOnly: true,
    path: '/',
    expires: new Date(0),
  });
  return response;
}
