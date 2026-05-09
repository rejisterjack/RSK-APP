import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";
import type { Header } from "next/dist/lib/load-custom-routes";
import bundleAnalyzer from "@next/bundle-analyzer";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

const withMDX = createMDX({
	// Add markdown plugins here if needed (e.g., remark-gfm, rehype-highlight)
	options: {
		// Enable JSX in MDX files
		jsx: true,
	},
});

const nextConfig: NextConfig = {
	// Enable MDX page support
	pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],

	// "standalone" enables output file tracing — produces minimal function bundles
	// by including only necessary dependencies. Reduces cold start times on both
	// Vercel serverless functions and Docker deployments.
	// output: "standalone" — not needed for Vercel, only for Docker/self-hosted
	experimental: {
		// Partial Prerendering - improves TTFB by streaming static shell
		// Requires Next.js 15+ canary version - disabled for stability
		// ppr: true,

		// Dynamic IO - enables async/await in Server Components
		// Renamed to cacheComponents in newer versions
		// dynamicIO: true,

		// Limit server action / API route body size to prevent memory exhaustion attacks
		serverActions: {
			bodySizeLimit: '4mb',
		},

		// Optimize package imports for better tree-shaking
		optimizePackageImports: [
				'recharts',
				'd3',
				'@react-pdf/renderer',
				'lucide-react',
				'date-fns',
				'framer-motion',
				'react-markdown',
				'@tanstack/react-virtual',
				'@tanstack/react-query',
				'@radix-ui/react-icons',
				'cmdk',
				'sonner',
				'archiver',
				'docx',
				'dompurify',
				'i18next',
				'react-i18next',
				'zustand',
				'@hookform/resolvers',
				'react-hook-form',
				'react-day-picker',
			],
	},
	webpack: (config, { isServer }): webpack.Configuration => {
		// Suppress "Serializing big strings impacts deserialization performance" warnings.
		// Prisma generated files (up to 268KB) trigger this because webpack's
		// PackFileCacheStrategy logs a warning when serializing strings > ~128KB.
		// This is purely informational — gzip compression on the filesystem cache
		// already mitigates the deserialization cost. The warning is safe to suppress.
		config.infrastructureLogging = {
			...config.infrastructureLogging,
			level: 'error',
		};
		if (config.cache && typeof config.cache === 'object' && 'type' in config.cache && config.cache.type === 'filesystem') {
			config.cache.compression = 'gzip';
		}

		// Exclude playwright from client-side bundle
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				playwright: false,
				net: false,
				tls: false,
				fs: false,
				crypto: false,
			};
		}
		// Exclude problematic modules from webpack processing
		// Server-only heavy deps are externalized to reduce bundle size and build time
		config.externals.push(
			/^playwright-core/,
			/^chromium-bidi/,
			/^nodemailer/,
			/^tesseract\.js/,
			/^pdf2pic/,
			/^pg-native/,
			/^@aws-sdk\/client-kms/,
			/^@xenova\/transformers/,   // 45MB — local embeddings (server-only)
			/^sharp/,                    // native binary — image processing (server-only)
			/^isolated-vm/,              // 16MB — code execution sandbox (server-only)
			/^samlify/,                  // SAML SSO (server-only)
			/^ably/,                     // 9.2MB — realtime messaging (server-only)
		);

		// thread-stream (used by pino) spawns worker threads via dynamic require("lib/worker.js")
		// which breaks under webpack bundling with output: "standalone" and is unavailable on
		// Vercel serverless. Resolve to false — pino works without it when no transports are used.
		config.resolve.alias = {
			...config.resolve.alias,
			'thread-stream': false,
		};

		// Prevent pg from trying to load optional native bindings
		// Resolve optional OTEL peer deps to false to suppress "Module not found" warnings
		config.resolve.alias = {
			...config.resolve.alias,
			'pg-native': false,
			'@opentelemetry/exporter-jaeger': false,
			'@opentelemetry/winston-transport': false,
		};

		return config;
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
		],
		formats: ["image/avif", "image/webp"],
	},
	poweredByHeader: false,

	async headers(): Promise<Header[]> {
		// Note: Access-Control-Allow-Origin is now handled dynamically in middleware.ts
		// to properly handle multiple allowed origins per the HTTP spec
		return [
			{
				source: "/api/:path*",
				headers: [
					// CORS headers are set dynamically in middleware.ts
					// This fixes the invalid multi-value Access-Control-Allow-Origin header issue
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, POST, PUT, DELETE, OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value: "Content-Type, Authorization, X-Requested-With, X-Request-ID, X-API-Key, X-CSRF-Token",
					},
					{
						key: "Access-Control-Allow-Credentials",
						value: "true",
					},
					{
						key: "Access-Control-Max-Age",
						value: "86400",
					},
				],
			},
			// PWA headers
			{
				source: "/manifest.json",
				headers: [
					{
						key: "Content-Type",
						value: "application/manifest+json",
					},
					{
						key: "Cache-Control",
						value: "public, max-age=0, must-revalidate",
					},
				],
			},
			{
				source: "/sw.js",
				headers: [
					{
						key: "Service-Worker-Allowed",
						value: "/",
					},
					{
						key: "Cache-Control",
						value: "public, max-age=0, must-revalidate",
					},
				],
			},
			{
				source: "/icons/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
		];
	},
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(withBundleAnalyzer(withMDX(nextConfig)), {
      silent: true,
    })
  : withBundleAnalyzer(withMDX(nextConfig));
