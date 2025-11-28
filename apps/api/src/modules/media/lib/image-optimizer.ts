import sharp from 'sharp';
import { storageConfig } from '../../../config/index.js';

export type MediaVariants = {
  thumbnail?: { width: number; height?: number; key: string };
  sm?: { width: number; key: string };
  md?: { width: number; key: string };
  lg?: { width: number; key: string };
};

export type GeneratedVariantFile = {
  key: string;
  buffer: Buffer;
  contentType: string;
};

type GenerateVariantsInput = {
  buffer: Buffer;
  contentType: string;
  baseKey: string; // original object key (used for deriving variant key)
};

const VARIANT_SUFFIX = {
  thumbnail: 'thumb',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

function getBaseKeyWithoutExt(key: string): string {
  const idx = key.lastIndexOf('.');
  if (idx === -1) return key;
  return key.slice(0, idx);
}

type VariantsConfig = typeof storageConfig.assets['content-image']['variants'];

export async function generateImageVariants(
  input: GenerateVariantsInput & { variantsConfig?: VariantsConfig }
): Promise<{ variants: MediaVariants; files: GeneratedVariantFile[] }> {
  const {
    buffer,
    contentType,
    baseKey,
    variantsConfig = storageConfig.assets['content-image'].variants,
  } = input;

  // Video ise variant üretme
  if (contentType.startsWith('video/')) {
    return { variants: {}, files: [] };
  }

  const base = getBaseKeyWithoutExt(baseKey);
  const outputExt = 'webp';
  const outputContentType = 'image/webp';

  const variantTasks: Array<Promise<{ key: string; buffer: Buffer } | null>> = [];
  const variants: MediaVariants = {};

  // Thumbnail (crop)
  if (variantsConfig.thumbnail) {
    const { width, height, quality } = variantsConfig.thumbnail;
    const key = `${base}-${VARIANT_SUFFIX.thumbnail}.${outputExt}`;
    variants.thumbnail = { width, height, key };
    variantTasks.push(
      sharp(buffer)
        .resize({ width, height, fit: 'cover' })
        .toFormat('webp', { quality })
        .toBuffer()
        .then((buf) => ({ key, buffer: buf }))
    );
  }

  // sm/md/lg
  (['sm', 'md', 'lg'] as const).forEach((sizeKey) => {
    const cfg = variantsConfig[sizeKey];
    if (!cfg) return;
    const { width, quality } = cfg;
    const key = `${base}-${VARIANT_SUFFIX[sizeKey]}.${outputExt}`;
    (variants as any)[sizeKey] = { width, key };
    variantTasks.push(
      sharp(buffer)
        .resize({ width })
        .toFormat('webp', { quality })
        .toBuffer()
        .then((buf) => ({ key, buffer: buf }))
    );
  });

  const resolved = await Promise.all(variantTasks);
  const files: GeneratedVariantFile[] = resolved
    .filter((r): r is { key: string; buffer: Buffer } => !!r)
    .map((r) => ({
      key: r.key,
      buffer: r.buffer,
      contentType: outputContentType,
    }));

  return { variants, files };
}
