import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function getSupabasePublicObjectUrl(bucket: string, path: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  const base = baseUrl.replace(/\/$/, "");
  const safePath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${safePath}`;
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/auth");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,name,updated_at,thumbnail_path,meta")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const cards = await Promise.all(
    (projects ?? []).map(async (project) => {
      const meta = project.meta && typeof project.meta === "object" && !Array.isArray(project.meta) ? (project.meta as Record<string, unknown>) : {};
      const bucket = typeof meta.thumbnailBucket === "string" ? meta.thumbnailBucket : "project-thumbnails";

      let thumbnailUrl: string | null = null;
      if (project.thumbnail_path) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(project.thumbnail_path, 60 * 60);
        thumbnailUrl = data?.signedUrl ?? null;
        if (!thumbnailUrl) thumbnailUrl = getSupabasePublicObjectUrl(bucket, project.thumbnail_path);
      }

      return { ...project, thumbnailUrl };
    })
  );

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(120,113,108,0.18),transparent_55%)]" />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Dashboard</div>
            <h1 className="mt-3 font-serif text-4xl text-stone-900">Your projects</h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              최근 작업을 이어서 편집하거나, 새로운 프로젝트를 시작하세요.
            </p>
          </div>
          <Link
            href="/projects/create"
            className="inline-flex w-fit items-center justify-center rounded-full bg-stone-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-stone-50 transition-all duration-300 hover:bg-stone-800"
          >
            New Project
          </Link>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-[28px] border border-stone-200/80 bg-white/60 p-10 text-center shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="font-serif text-2xl text-stone-900">No projects yet</div>
            <div className="mt-3 text-sm text-stone-600">도면을 업로드하고 첫 번째 공간을 만들어 보세요.</div>
            <div className="mt-8">
              <Link
                href="/projects/create"
                className="inline-flex items-center justify-center rounded-full bg-stone-900 px-7 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-stone-50 transition-all duration-300 hover:bg-stone-800"
              >
                Create project
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((project) => {
              const initial = project.name?.trim()?.[0]?.toUpperCase() ?? "P";

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group rounded-[28px] border border-stone-200/80 bg-white/60 shadow-[0_22px_70px_-60px_rgba(0,0,0,0.45)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80"
                >
                  <div className="p-4">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] border border-stone-200 bg-stone-100">
                      {project.thumbnailUrl ? (
                        <Image
                          src={project.thumbnailUrl}
                          alt={project.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(28,25,23,0.08),transparent_60%)]">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-stone-200 bg-white text-lg font-semibold text-stone-800 shadow-sm">
                            {initial}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <div className="truncate font-serif text-2xl text-stone-900">{project.name}</div>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">
                      Updated · {formatUpdatedAt(project.updated_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
