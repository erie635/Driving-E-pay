import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;
  const token = request.nextUrl.searchParams.get('token');

  // Allow branch dashboard access if a token is present
  if (path.startsWith('/dashboard/branch') && token) {
    return NextResponse.next();
  }

  // Your existing authentication logic (if any) would go here.
  // If you use a session cookie, uncomment and adapt:
  // const session = request.cookies.get('session');
  // if (!session && path.startsWith('/dashboard')) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/branch-access/:path*'],
};
