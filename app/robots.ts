import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // özel/oturumluk alanlar dizine girmesin
        disallow: ["/yonetim", "/hesap/", "/mesajlar", "/bildirimler", "/koleksiyon", "/pazar/ilanlarim", "/pazar/yeni", "/forum/yeni", "/api/"],
      },
    ],
    sitemap: "https://jestbrick.com/sitemap.xml",
  };
}
