import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;

  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true);
      redirect('/dashboard');
    } catch {
      // fall through to login
    }
  }
  redirect('/login');
}