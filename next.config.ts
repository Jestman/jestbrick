import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
