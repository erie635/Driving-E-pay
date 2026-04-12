import { adminDb } from '@/lib/firebase/admin';
import Link from 'next/link';

export default async function BranchesPage() {
  const branchesSnapshot = await adminDb.collection('branches').get();
  const branches = branchesSnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
    location: doc.data().location || null,
  }));

  return (
    <div className="p-6">
      {/* Header with logo centered above the title */}
      <div className="flex flex-col items-center justify-center mb-8">
        <img
          src="/logopds.jpg"
          alt="Logo"
          className="h-30 w-auto object-contain mb-4"
          fetchPriority="high"
          loading="eager"
        />
        <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent text-center">
          Our Branches
        </h1>
      </div>

      {branches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 text-lg">No branches found. Create one first.</p>
          <Link
            href="/dashboard/admin/add-branch"
            className="inline-block mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
          >
            + Add Branch
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/dashboard/branch/${branch.id}`}
              className="group relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <h2 className="text-xl font-semibold text-white">{branch.name}</h2>
              {branch.location && (
                <p className="text-white/60 mt-2 flex items-center gap-1">
                  <span>📍</span> {branch.location}
                </p>
              )}
              <div className="mt-4 text-sm text-white/40 group-hover:text-white/60 transition-colors">
                Click to view details →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}