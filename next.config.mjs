/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    // Ignorar errores de ESLint en Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignorar errores de TypeScript en Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;