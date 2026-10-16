// Leave headroom below the hosted function's 4.5 MB request limit. Count UTF-8
// bytes, not JS characters: localized copy can use several bytes per character.
export const MAX_CLOUD_JSON_BYTES = 4_000_000;
export const WORKSPACE_TOO_LARGE = "Workspace exceeds the 4 MB cloud metadata limit. Reduce the workspace size or replace inline images with uploaded files. Your previous cloud save is preserved.";
export function cloudPayloadTooLarge(json: string): boolean {
  return new TextEncoder().encode(json).length > MAX_CLOUD_JSON_BYTES;
}
