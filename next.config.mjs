/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // sw.js ne doit jamais être mis en cache — le navigateur doit toujours
        // vérifier s'il y a une nouvelle version à l'ouverture de l'app.
        // Service-Worker-Allowed: / garantit que le scope couvre toute l'app
        // (critique sur iOS PWA qui est strict sur le scope).
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
