import type { NextConfig } from "next";

// Site 100% estático: pode ser publicado no GitHub Pages, na Vercel ou em qualquer hospedagem.
// No GitHub Pages o site fica em /<repositório>, informado pelo workflow em NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
