/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O repo tem vários package-lock (app Expo na raiz + backoffice).
  // Fixa a raiz do backoffice para o Next não inferir a do app.
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
