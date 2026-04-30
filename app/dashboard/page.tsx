'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client'; // adjust path to your firebase client
import { onAuthStateChanged, User } from 'firebase/auth';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return <div className="p-4 text-center">Checking authentication...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Please log in</h1>
        <p className="text-gray-600">You need to sign in to access the dashboard.</p>
        {/* Optional: add a login button or redirect */}
      </div>
    );
  }

  // ✅ User is logged in – show the dashboard content
  return (
    <div className="flex flex-col md:flex-row gap-0 items-stretch">
      {/* Left side: history text */}
      <div className="flex-1 p-4 md:p-6 space-y-3 md:space-y-4 bg-white rounded-t-lg md:rounded-l-lg md:rounded-tr-none">
        <h1 className="text-3xl md:text-5xl font-bold text-blue-400">HARMFLOW</h1>
        <h2 className="text-lg md:text-xl font-semibold text-indigo-600">Our Journey</h2>
        <div className="prose prose-sm md:prose-base prose-gray max-w-none text-gray-700 space-y-2 md:space-y-3">
          <p>
            Hamflow (originally named Harmlow) was founded in 2010 as a small community learning centre
            with just 12 students and a single branch. The vision was simple: provide quality, affordable
            education that adapts to each student’s needs.
          </p>
          <p>
            By 2015, Hamflow had expanded to three branches across the city, introducing modern teaching
            methods and digital progress tracking. The school became known for its strong emphasis on
            languages (B1/B2, C1) and professional driving courses (A1, A2, A3).
          </p>
          <p>
            In 2020, Hamflow launched its own digital account management system – the very dashboard you
            are using now. This allowed real‑time fee tracking, automated admission numbers, and branch‑wise
            performance analytics.
          </p>
          <p>
            Today, Hamflow serves over <strong>500 active students</strong> across four main branches,
            maintaining a 94% exam pass rate and a growing alumni network. The name “Hamflow” reflects
            the school’s core philosophy: <em>“knowledge flows freely, like water – reaching everyone,
            everywhere.”</em>
          </p>
          <p className="text-xs md:text-sm text-gray-500 italic">
            * All dashboard logic (branch selection, student lists, fee calculations) remains unchanged.
          </p>
        </div>
      </div>

      {/* Right side: image fully visible (object-contain) */}
      <div className="md:w-1/2 bg-gray-100 rounded-b-lg md:rounded-r-lg md:rounded-bl-none overflow-hidden min-h-[300px] md:min-h-full flex items-center justify-center">
        <img
          src="/five.jpg"
          alt="Five"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}