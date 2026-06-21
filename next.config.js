/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'node-ssh', 'archiver', 'pg', 'mysql2', 'kafkajs'],
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundling of native DB drivers and Kafka — loaded at runtime only
      const externals = ['pg', 'pg-native', 'mysql2', 'kafkajs', 'mongodb']
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ...externals,
      ]
    }
    return config
  },
}

module.exports = nextConfig
