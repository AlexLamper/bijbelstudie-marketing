import { readFileSync, existsSync } from 'node:fs';

// Old links (before projects) keep working: /week/2026-W44 -> /<first project>/week/2026-W44
const reg = existsSync('./lib/projects.generated.json') ? JSON.parse(readFileSync('./lib/projects.generated.json', 'utf8')) : { projects: [] };
const first = (reg.projects.find(p => p.enabled) ?? reg.projects[0])?.id;

/** @type {import('next').NextConfig} */
export default {
  eslint: { ignoreDuringBuilds: true },
  // the engine (Playwright, ffmpeg) never runs inside the studio
  outputFileTracingExcludes: { '*': ['engine/**', 'assets/**', 'data/**', 'out/**', 'projects/**', 'planner/**', 'scripts/**'] },
  images: { unoptimized: true },
  async redirects() {
    if (!first) return [];
    return [
      { source: '/week/:week', destination: `/${first}/week/:week`, permanent: false },
      ...['reports', 'comments', 'stats'].map(s => ({ source: `/${s}`, destination: `/${first}/${s}`, permanent: false })),
    ];
  },
};
