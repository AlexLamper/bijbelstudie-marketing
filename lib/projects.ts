import type { CSSProperties } from 'react';
import registry from './projects.generated.json';

// Every project the studio can show. Source: projects/<id>/project.json, collected by
// scripts/sync-projects.mjs (runs before dev and build) into projects.generated.json.
/** Public pages of a project (project.json "links"): store links and account names to fall back on. */
export type ProjectLinks = { appStore?: string; playStore?: string; instagram?: string; facebook?: string; tiktok?: string; youtube?: string };

export type Project = {
  id: string; name: string; tagline: string; enabled: boolean; db: string; web: string; platforms: string[];
  timezone: string; links: ProjectLinks;
  theme: { accent: string; accentDark: string; accentSoft: string; accentFaint: string; cta: string; panel: string };
  logo: { mark: string | null; full: string | null };
};

export const PROJECTS = registry.projects as Project[];
export const DEFAULT_PROJECT = (PROJECTS.find(p => p.enabled) ?? PROJECTS[0])?.id;

export const getProject = (id: string | undefined | null) => PROJECTS.find(p => p.id === id) ?? null;

/** CSS variables that give a subtree the project's colours (Tailwind utilities read these). */
export function projectStyle(p: Project): CSSProperties {
  return {
    '--color-accent': p.theme.accent, '--color-accent-dark': p.theme.accentDark,
    '--color-accent-soft': p.theme.accentSoft, '--color-accent-faint': p.theme.accentFaint,
    '--color-cta': p.theme.cta, '--color-panel': p.theme.panel,
  } as CSSProperties;
}
