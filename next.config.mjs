/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // En-têtes de sécurité sur toutes les pages et routes.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // CSP partielle : interdit l'intégration de l'appli dans une autre page, les plugins,
          // le détournement de <base> et l'envoi de formulaires ailleurs. Scripts non restreints.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
        ],
      },
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
