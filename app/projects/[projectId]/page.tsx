import { ModuleShell } from "@/components/navigation/ModuleShell";
import { ProjectOverview } from "@/components/ProjectOverview";

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return (
    <ModuleShell section="project">
      <ProjectOverview projectId={params.projectId} />
    </ModuleShell>
  );
}
