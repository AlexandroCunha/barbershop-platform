/** URL for a photo the owner uploaded. Names may contain spaces, so they are encoded. */
export const mediaSrc = (name: string): string => `/media/${encodeURIComponent(name)}`;
