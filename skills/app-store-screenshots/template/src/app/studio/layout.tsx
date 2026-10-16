export { WorkspaceAccess as default } from "@/components/auth/workspace-access";
// Authentication and account scope must be evaluated per request, even if the
// build environment was configured for local mode.
export const dynamic = "force-dynamic";
