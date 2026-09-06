import { SkillDetail } from "@/components/SkillCatalog";

export default function SkillDetailPage({ params }: { params: { skillId: string } }) {
  return <SkillDetail skillId={params.skillId} />;
}
