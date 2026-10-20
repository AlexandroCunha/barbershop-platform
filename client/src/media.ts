/** URL for a photo a shop's owner uploaded. Names may contain spaces, so they are encoded. */
export const mediaSrc = (slug: string, name: string): string =>
  `/media/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`;
