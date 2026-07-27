import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reserved for domain migration 301 redirects.
  async redirects() {
    return [];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
