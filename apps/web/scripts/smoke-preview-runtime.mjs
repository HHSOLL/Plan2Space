import process from "node:process";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function toAbsoluteUrl(baseUrl, candidate) {
  return new URL(candidate, baseUrl).toString();
}

async function fetchText(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "plan2space-preview-smoke/1.0"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Fetch failed for ${url}: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }
  return response.text();
}

async function main() {
  const pageUrl = getArg("url", "");
  const expected = getArg("expected", process.env.NEXT_PUBLIC_RAILWAY_API_URL || "");

  if (!pageUrl) {
    throw new Error("Missing --url=<preview-or-production-url>.");
  }
  if (!expected) {
    throw new Error("Missing --expected=<railway-api-url>.");
  }

  const html = await fetchText(pageUrl);
  const scriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+_next\/static\/[^"]+\.js[^"]*)"/g)];
  if (scriptMatches.length === 0) {
    throw new Error(`No Next.js script assets found in ${pageUrl}`);
  }

  const assetUrls = [...new Set(scriptMatches.map((match) => toAbsoluteUrl(pageUrl, match[1])))];
  let matchedAsset = null;

  for (const assetUrl of assetUrls) {
    const script = await fetchText(assetUrl);
    if (script.includes(expected)) {
      matchedAsset = assetUrl;
      break;
    }
  }

  if (!matchedAsset) {
    throw new Error(`Expected API URL ${expected} was not found in any client bundle.`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        pageUrl,
        expected,
        matchedAsset
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[smoke-preview-runtime] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
