/** @type {import("next").NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseRemotePattern = [];

try {
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    const protocol = u.protocol.replace(":", "");
    supabaseRemotePattern = [
      { protocol, hostname: u.hostname, pathname: "/storage/v1/object/public/**" },
      { protocol, hostname: u.hostname, pathname: "/storage/v1/object/sign/**" }
    ];
  }
} catch {
  supabaseRemotePattern = [];
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@webinterior/shared"],
  images: {
    remotePatterns: supabaseRemotePattern
  }
};

module.exports = nextConfig;
