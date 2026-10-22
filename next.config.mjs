/** @type {import('next').NextConfig} */
export default {
  eslint: { ignoreDuringBuilds: true },
  // the engine (Playwright, ffmpeg) never runs inside the dashboard
  outputFileTracingExcludes: { '*': ['engine/**', 'assets/**', 'data/**', 'out/**', 'content/**'] },
  images: { unoptimized: true },
};
