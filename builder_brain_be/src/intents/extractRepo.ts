export type RepoRef = {
  owner: string;
  repo: string;
};

/** Pull owner/repo from a user message (e.g. my-repo, owner/my-repo). */
export function extractRepoFromMessage(message: string): RepoRef | null {
  const fullMatch = message.match(
    /\b([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)\b/,
  );
  if (fullMatch?.[1] && fullMatch[2]) {
    return { owner: fullMatch[1], repo: fullMatch[2] };
  }

  const slugMatch = message.match(/\b([a-z0-9]+(?:-[a-z0-9]+)+)\b/i);
  if (slugMatch?.[1] && slugMatch[1].length >= 4) {
    return { owner: "", repo: slugMatch[1] };
  }

  return null;
}
