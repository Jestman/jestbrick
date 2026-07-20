import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // clickjacking: site hiçbir yerde iframe'e alınamaz
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Supabase Storage (katalog görselleri kopyalandıktan sonra)
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // İlk kurulumda görseller henüz kopyalanmadıysa Rebrickable CDN
      { protocol: "https", hostname: "cdn.rebrickable.com" },
    ],
  },
};

export default nextConfig;
