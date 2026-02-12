import { ReactNode } from "react";
import { useRoles } from "@/hooks/use-roles";
import { Layout } from "@/components/Layout";
import { CustomerLayout } from "@/components/CustomerLayout";

interface RoleAwareLayoutProps {
  children: ReactNode;
}

export function RoleAwareLayout({ children }: RoleAwareLayoutProps) {
  const { isSuperAdmin, isOrgAdmin, loading } = useRoles();

  // While loading roles, show nothing to prevent flash
  if (loading) return null;

  if (isSuperAdmin || isOrgAdmin) {
    return <Layout>{children}</Layout>;
  }

  return <CustomerLayout>{children}</CustomerLayout>;
}
