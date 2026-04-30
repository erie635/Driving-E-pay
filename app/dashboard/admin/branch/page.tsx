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
    <>
      <style>{`
        /* ===== FULL CONTROL CSS – overrides Tailwind, responsive, small fonts ===== */
        /* Now adapted for white background – text is dark, backgrounds light */
        .p-6 {
          padding: 1rem !important;
        }

        /* Header container */
        .flex.flex-col.items-center.justify-center.mb-8 {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 1.5rem !important;
        }

        /* Logo */
        .h-30.w-auto.object-contain.mb-4 {
          height: 70px !important;
          max-width: 100% !important;
          width: auto !important;
          object-fit: contain !important;
          margin-bottom: 0.75rem !important;
        }

        /* Page title – dark gradient */
        .text-3xl.font-bold.text-white.bg-gradient-to-r.from-white.to-white\\/70.bg-clip-text.text-transparent.text-center {
          font-size: 1.6rem !important;
          font-weight: bold !important;
          color: #000 !important;
          background: linear-gradient(to right, #000, rgba(0,0,0,0.7)) !important;
          background-clip: text !important;
          -webkit-background-clip: text !important;
          color: transparent !important;
          text-align: center !important;
          margin: 0 !important;
        }

        /* Empty state container */
        .text-center.py-12 {
          text-align: center !important;
          padding: 2rem 1rem !important;
        }

        /* Empty state message – dark gray */
        .text-white\\/60.text-lg {
          font-size: 0.95rem !important;
          color: rgba(0,0,0,0.6) !important;
          margin-bottom: 0.75rem !important;
        }

        /* Add branch button – light background, dark text */
        .inline-block.mt-4.px-6.py-2.bg-white\\/10.hover\\:bg-white\\/20.rounded-lg.text-white.transition {
          display: inline-block !important;
          margin-top: 0.75rem !important;
          padding: 0.4rem 1.2rem !important;
          background: rgba(0,0,0,0.05) !important;
          border-radius: 0.5rem !important;
          color: #000 !important;
          transition: all 0.2s ease !important;
          font-size: 0.85rem !important;
        }
        .inline-block.mt-4.px-6.py-2.bg-white\\/10.hover\\:bg-white\\/20.rounded-lg.text-white.transition:hover {
          background: rgba(0,0,0,0.1) !important;
        }

        /* Grid system (responsive, smaller gap) */
        .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 {
          display: grid !important;
          grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          gap: 1rem !important;
        }
        @media (min-width: 768px) {
          .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (min-width: 1024px) {
          .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        /* Branch card – light background, dark text */
        .group.relative.bg-white\\/10.backdrop-blur-sm.border.border-white\\/20.rounded-xl.p-6.hover\\:bg-white\\/20.transition-all.duration-300.hover\\:scale-\\[1\\.02\\].hover\\:shadow-2xl {
          position: relative !important;
          background: rgba(0,0,0,0.03) !important;
          backdrop-filter: blur(4px) !important;
          border: 1px solid rgba(0,0,0,0.1) !important;
          border-radius: 0.75rem !important;
          padding: 1rem !important;
          transition: all 0.3s ease !important;
          display: block !important;
          text-decoration: none !important;
        }
        .group.relative.bg-white\\/10.backdrop-blur-sm.border.border-white\\/20.rounded-xl.p-6.hover\\:bg-white\\/20.transition-all.duration-300.hover\\:scale-\\[1\\.02\\].hover\\:shadow-2xl:hover {
          background: rgba(0,0,0,0.08) !important;
          transform: scale(1.02) !important;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05) !important;
        }

        /* Shine overlay (kept as subtle light overlay) */
        .absolute.inset-0.bg-gradient-to-r.from-white\\/0.via-white\\/5.to-white\\/0.opacity-0.group-hover\\:opacity-100.transition-opacity.rounded-xl {
          position: absolute !important;
          inset: 0 !important;
          background: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.03), rgba(0,0,0,0)) !important;
          opacity: 0 !important;
          transition: opacity 0.3s ease !important;
          border-radius: 0.75rem !important;
          pointer-events: none !important;
        }
        .group:hover .absolute.inset-0.bg-gradient-to-r.from-white\\/0.via-white\\/5.to-white\\/0.opacity-0.group-hover\\:opacity-100.transition-opacity.rounded-xl {
          opacity: 1 !important;
        }

        /* Branch name – dark */
        .text-xl.font-semibold.text-white {
          font-size: 1.125rem !important;
          font-weight: 600 !important;
          color: #000 !important;
          margin: 0 0 0.25rem 0 !important;
        }

        /* Location text – dark gray */
        .text-white\\/60.mt-2.flex.items-center.gap-1 {
          font-size: 0.8rem !important;
          color: rgba(0,0,0,0.6) !important;
          margin-top: 0.5rem !important;
          display: flex !important;
          align-items: center !important;
          gap: 0.25rem !important;
        }

        /* Details link – darker gray */
        .mt-4.text-sm.text-white\\/40.group-hover\\:text-white\\/60.transition-colors {
          margin-top: 0.75rem !important;
          font-size: 0.7rem !important;
          color: rgba(0,0,0,0.4) !important;
          transition: color 0.2s ease !important;
        }
        .group:hover .mt-4.text-sm.text-white\\/40.group-hover\\:text-white\\/60.transition-colors {
          color: rgba(0,0,0,0.6) !important;
        }

        /* ===== RESPONSIVE (small devices) ===== */
        @media (max-width: 640px) {
          .p-6 {
            padding: 0.75rem !important;
          }
          .h-30.w-auto.object-contain.mb-4 {
            height: 50px !important;
          }
          .text-3xl.font-bold.text-white.bg-gradient-to-r.from-white.to-white\\/70.bg-clip-text.text-transparent.text-center {
            font-size: 1.3rem !important;
          }
          .group.relative.bg-white\\/10.backdrop-blur-sm.border.border-white\\/20.rounded-xl.p-6.hover\\:bg-white\\/20.transition-all.duration-300.hover\\:scale-\\[1\\.02\\].hover\\:shadow-2xl {
            padding: 0.75rem !important;
          }
          .text-xl.font-semibold.text-white {
            font-size: 1rem !important;
          }
          .text-white\\/60.mt-2.flex.items-center.gap-1 {
            font-size: 0.7rem !important;
          }
          .mt-4.text-sm.text-white\\/40.group-hover\\:text-white\\/60.transition-colors {
            font-size: 0.65rem !important;
          }
        }

        /* Body background – white */
        body {
          background-color: #ffffff;
        }
      `}</style>

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
    </>
  );
}