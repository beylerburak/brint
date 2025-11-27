export function buildMediaObjectKey(input: {
  workspaceId: string;
  brandId?: string;
  fileId: string;
  originalFileName: string;
  now?: Date;
}) {
  const { workspaceId, brandId, fileId, originalFileName } = input;
  const ext = (originalFileName.split('.').pop() || '').toLowerCase();
  const date = input.now ?? new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');

  return `${workspaceId}/${brandId ?? '_'}/media/${y}/${m}/${fileId}.${ext}`;
}
