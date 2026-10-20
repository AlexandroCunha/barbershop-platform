/** Extensions the owner's photos may use. */
export const MEDIA_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

/**
 * A file name inside media/: letters, digits, spaces, dots, dashes and
 * underscores, starting with a letter or digit. No slashes, so no path tricks.
 */
const MEDIA_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,118}$/;

export function isMediaFileName(name: string): boolean {
  return MEDIA_NAME_PATTERN.test(name) && !name.includes("..");
}

export function hasMediaExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return MEDIA_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Path under which the site serves one shop's photo. */
export function mediaUrl(slug: string, name: string): string {
  return `/media/${slug}/${encodeURIComponent(name)}`;
}
