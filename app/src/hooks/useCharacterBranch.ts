"use client";

import { useEffect, useState } from "react";
import { loadBranchPath } from "@/lib/characters/branch";

// Same shape as useCharacterAffinity: read-on-mount + refresh(), since the
// underlying value only ever changes from this same tab's own actions
// (answering a chapter decision writes it — see SpankGame/SpankGameRate),
// not from anything external that would need a live subscription.
export function useCharacterBranch(address: string, characterId: string) {
  const [branchPath, setBranchPath] = useState(() => loadBranchPath(address, characterId));

  const refresh = () => setBranchPath(loadBranchPath(address, characterId));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, characterId]);

  return { branchPath, refresh };
}
