import React from "react";
import { EmptyIllustration } from "./EmptyIllustration";

/**
 * Registry of bundled illustrations. Deliberately starts small — new entries
 * are added when a screen's own redesign (Part C spec) calls for one, not
 * pre-built speculatively ahead of a real screen composition.
 */
const registry = {
  empty: EmptyIllustration,
} as const;

export type IllustrationName = keyof typeof registry;

export interface IllustrationProps {
  name: IllustrationName;
  size?: number;
}

/** Resolves a bundled illustration by name for `EmptyState`'s `illustrationName` shorthand. */
export function Illustration({ name, size }: IllustrationProps): React.ReactElement {
  const Component = registry[name];
  return <Component size={size} />;
}

export { EmptyIllustration };
