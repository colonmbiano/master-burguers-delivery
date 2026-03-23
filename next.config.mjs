/** @type {import('next').NextConfig} */
const nextConfig = {
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