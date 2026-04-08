import { Compass, Sparkles } from "lucide-react";
import { fetchShowcaseSnapshotResult } from "../../lib/api/showcase";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { items: snapshots, error: showcaseError } = await fetchShowcaseSnapshotResult(24);

  return (
    <div className="min-h-screen bg-[#f5f1e8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[34px] bg-[#191512] p-8 text-[#f9f4ec] shadow-[0_34px_90px_rgba(0,0,0,0.22)] sm:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d8baa0]">
              <Sparkles className="h-4 w-4" />
              <span>Published snapshots</span>
            </div>
            <h1 className="mt-8 text-5xl font-cormorant font-light tracking-tight sm:text-6xl">
              Builder rooms that are actually live.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#d7cbc1]">
              This showcase is now driven by pinned share snapshots. Every card opens the exact read-only room version
              that was published, not a drifting latest draft.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Published rooms</div>
              <div className="mt-4 text-4xl font-cormorant">{showcaseError ? "Unavailable" : snapshots.length}</div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                {showcaseError
                  ? "The gallery feed could not be loaded. Public publishing is not being reported correctly right now."
                  : "Permanent, gallery-visible snapshots curated from the builder-first editor flow."}
              </p>
            </div>
            <div className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-[0_16px_44px_rgba(68,52,34,0.1)] backdrop-blur">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Viewer contract</div>
              <div className="mt-4 flex items-center gap-3 text-2xl font-cormorant">
                <Compass className="h-5 w-5 text-[#c06e3d]" />
                Pinned snapshot → Shared viewer
              </div>
              <p className="mt-3 text-sm leading-7 text-[#61574e]">
                Publishing now deep-links straight into the existing shared viewer surface.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-14">
          <div className="mb-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7c70]">
            <Sparkles className="h-4 w-4" />
            <span>Showcase archive</span>
          </div>

          {showcaseError ? (
            <div className="rounded-[34px] border border-[#c06e3d]/20 bg-[#fff8f3] p-12 text-center shadow-[0_16px_44px_rgba(68,52,34,0.08)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b56a3e]">Showcase unavailable</div>
              <h2 className="mt-4 text-4xl font-cormorant font-light">The public archive could not be loaded.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                {showcaseError} Check the showcase API and environment wiring before treating this as an empty gallery.
              </p>
            </div>
          ) : snapshots.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {snapshots.map((snapshot) => (
                <PublishedSnapshotCard
                  key={snapshot.id}
                  token={snapshot.token}
                  thumbnail={snapshot.thumbnail}
                  previewMeta={snapshot.previewMeta}
                  publishedAt={snapshot.published_at}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[34px] border border-dashed border-black/12 bg-white/70 p-12 text-center shadow-[0_16px_44px_rgba(68,52,34,0.08)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Showcase empty</div>
              <h2 className="mt-4 text-4xl font-cormorant font-light">No published snapshots yet.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                Create a permanent view-only link from the editor and mark it visible in the gallery. It will appear here
                as a pinned public room snapshot.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
