'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from 'firebase/auth';

export default function AddBranchPage() {
  const router = useRouter();
  const auth = getAuth();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const IDLE_TIME = 20 * 60 * 1000;

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);

    idleTimer.current = setTimeout(async () => {
      await signOut(auth);
      router.push('/login');
    }, IDLE_TIME);
  };

  useEffect(() => {
    const events = ['click', 'mousemove', 'keydown', 'scroll'];

    const handleActivity = () => {
      resetIdleTimer();
    };

    events.forEach((event) =>
      window.addEventListener(event, handleActivity)
    );

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await setPersistence(auth, browserLocalPersistence);

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        console.log('USER:', currentUser);

        if (!currentUser) {
          router.push('/login');
        } else {
          setUser(currentUser);

          // 🔥🔥 ADD THIS (CRITICAL FIX)
          const token = await currentUser.getIdToken();

          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });

          resetIdleTimer();
        }

        setAuthLoading(false);
      });

      return () => unsubscribe();
    };

    initAuth();
  }, [router]);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Branch name is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await addDoc(collection(db, 'branches'), {
        name: name.trim(),
        location: location.trim() || null,
        createdAt: new Date(),
        createdBy: user?.uid || null,
      });

      setSuccess(true);

      setName('');
      setLocation('');

      setTimeout(() => {
        router.push('/dashboard/set-admin-claims');
      }, 1500);
    } catch (err: any) {
      console.error('Error adding branch:', err);
      setError('Failed to add branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-black">
        Checking authentication...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Logo and centered heading */}
      <div className="flex flex-col items-center justify-center mb-6">
        <img
          src="/logopds.jpg"
          alt="Logo"
          className="h-30 w-auto object-contain mb-4"
          fetchPriority="high"
          loading="eager"
        />
        <h1 className="text-2xl font-bold text-black text-center">
          Add New Branch
        </h1>
      </div>

      <div className="bg-gray-100 rounded-xl p-6 shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-black/80 text-sm mb-2">Branch Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Branch"
              className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-black/80 text-sm mb-2">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Nairobi, Kenya"
              className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg">
              Branch added successfully! Redirecting...
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Branch'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard/set-admin-claims')}
            className="w-full py-3 px-4 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}