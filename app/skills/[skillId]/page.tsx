import { SkillDetail } from "@/components/SkillCatalog";
import { ModuleShell } from "@/components/navigation/ModuleShell";

export default function SkillDetailPage({ params }: { params: { skillId: string } }) {
  return (
    <ModuleShell section="skills">
      <SkillDetail skillId={params.skillId} />
    </ModuleShell>
  );
}
