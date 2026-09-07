import { SkillCatalog } from "@/components/SkillCatalog";
import { ModuleShell } from "@/components/navigation/ModuleShell";
export const dynamic = "force-dynamic";

export default function SkillsPage() {
  return (
    <ModuleShell section="skills">
      <SkillCatalog />
    </ModuleShell>
  );
}
