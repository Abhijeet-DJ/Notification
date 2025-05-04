
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add configuration for local or deployed image source
      // Example for local development (assuming uploads are served from the same host)
      // You might need to adjust hostname for production deployment
      {
        protocol: 'http', // or 'https' if served over HTTPS locally
        hostname: 'localhost', // Or your specific dev hostname
        port: '9002', // The port your Next.js app runs on
        pathname: '/uploads/**', // Match the path where uploaded images are served
      },
      // Add a pattern for your deployed domain if necessary
      // {
      //   protocol: 'https',
      //   hostname: 'your-deployed-domain.com',
      //   port: '',
      //   pathname: '/uploads/**',
      // },
    ],
    // Allow serving images directly from the filesystem (if not using remotePatterns)
    // This is less common for dynamic uploads but can be used for static assets.
    // Use with caution as it can expose filesystem paths.
    // domains: ['localhost'], // Example for local development
    // unoptimized: true, // Disable optimization if necessary for debugging
  },
};

export default nextConfig;

