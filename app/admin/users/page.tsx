import { UserManagement } from "@/components/admin/UserManagement";
import { ModuleShell } from "@/components/navigation/ModuleShell";

export const dynamic = "force-dynamic";

export default function UserManagementPage() {
  return (
    <ModuleShell section="admin">
      <UserManagement />
    </ModuleShell>
  );
}
