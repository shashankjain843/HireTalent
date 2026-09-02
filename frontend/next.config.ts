import type { NextConfig } from "next";

const backendApiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiBase}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/company%20admin/:path*",
        destination: "/company-admin/:path*",
        permanent: true,
      },
      {
        source: "/company admin/:path*",
        destination: "/company-admin/:path*",
        permanent: true,
      },
      {
        source: "/companyadmin/:path*",
        destination: "/company-admin/:path*",
        permanent: true,
      },
      {
        source: "/super%20admin/:path*",
        destination: "/superadmin/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
