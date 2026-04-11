import { notFound } from "next/navigation";
import { fetchPublicSceneByToken, PublicSceneError } from "../../../lib/server/public-scenes";
import { SharedProjectClient } from "./SharedProjectClient";

interface SharedProjectPageProps {
  params: { token: string };
}

export default async function SharedProjectPage({ params }: SharedProjectPageProps) {
  let scene: Awaited<ReturnType<typeof fetchPublicSceneByToken>> | null = null;
  let isExpired = false;
  try {
    scene = await fetchPublicSceneByToken(params.token);
  } catch (error) {
    if (error instanceof PublicSceneError) {
      if (error.status === 404) {
        notFound();
      }
      if (error.status === 410) {
        isExpired = true;
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#f5f1e8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-black/10 bg-white/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">Link expired</div>
          <h1 className="mt-4 text-4xl font-cormorant font-light">This shared scene is no longer available.</h1>
          <p className="mt-4 text-sm leading-7 text-[#61574e]">
            The viewer token has expired. Ask the owner to publish a new permanent link from the editor.
          </p>
        </div>
      </div>
    );
  }

  if (!scene) {
    notFound();
  }

  return (
    <SharedProjectClient
      projectName={scene.projectName}
      projectDescription={scene.projectDescription}
      sceneBootstrap={scene.sceneBootstrap}
      linkPermission={scene.linkPermission}
      expiresAt={scene.expiresAt}
      pinnedVersionNumber={scene.pinnedVersionNumber}
      previewAssetSummary={scene.previewAssetSummary}
    />
  );
}
