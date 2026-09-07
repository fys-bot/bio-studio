import { FileCatalog } from "@/components/FileCatalog";
import { ModuleShell } from "@/components/navigation/ModuleShell";
export const dynamic = "force-dynamic";

export default function FilesPage() {
  return (
    <ModuleShell section="files">
      <FileCatalog />
    </ModuleShell>
  );
}
