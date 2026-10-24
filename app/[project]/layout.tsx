import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PROJECTS, getProject, projectStyle } from '@/lib/projects';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import NavLinks from '@/components/NavLinks';
import Toaster from '@/components/Toast';

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const p = getProject((await params).project);
  return { title: { default: p?.name ?? 'Studio', template: `%s - ${p?.name ?? 'Studio'}` } };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ project: string }> }) {
  const p = getProject((await params).project);
  if (!p) notFound();
  const others = PROJECTS.map(({ id, name, enabled, logo, theme }) => ({ id, name, enabled, mark: logo.mark, panel: theme.panel }));

  return (
    <div style={projectStyle(p)} className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-panel text-white shadow-[0_1px_0_rgb(255_255_255/0.06)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <ProjectSwitcher current={p.id} projects={others} />
          <NavLinks project={p.id} />
        </div>
      </header>
      {!p.enabled && (
        <div className="border-b border-orange-200 bg-orange-50">
          <p className="mx-auto max-w-6xl px-4 py-2.5 text-sm text-warn">
            <strong>{p.name} staat nog uit.</strong> De planner en het publiceren draaien pas als <code className="rounded bg-white/70 px-1">enabled</code> in <code className="rounded bg-white/70 px-1">projects/{p.id}/project.json</code> op <code className="rounded bg-white/70 px-1">true</code> staat.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
