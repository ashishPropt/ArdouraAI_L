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
      const SKIP = /^(pg|pg-native|mysql2|kafkajs|mongodb)(\/.*)?$/
      const prev = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)
      config.externals = [
        ...prev,
        ({ request }, callback) => {
          if (SKIP.test(request)) return callback(null, `commonjs ${request}`)
          callback()
        },
      ]
    }
    return config
  },
}

module.exports = nextConfig
