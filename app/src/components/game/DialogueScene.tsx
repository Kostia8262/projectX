"use client";

import { useState } from "react";
import type { DialogueTree } from "@/lib/content/types";
import { Eyebrow } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";

// Fullscreen VN-style bridge scene, rendered as an absolute overlay inside
// SpankGame/SpankGameRate's existing relative root — shown before the round
// (introDialogue) and/or after it (outroDialogue), see ChapterRecord in
// lib/content/types.ts. Every path is expected to converge back to one exit
// (a node with neither `next` nor `choices`), just at a different pace —
// that convergence is on the content author, this component only walks
// whatever graph it's given and calls onComplete() at the leaf.
export function DialogueScene({
  tree,
  accentColor,
  onComplete,
}: {
  tree: DialogueTree;
  accentColor?: string;
  onComplete: () => void;
}) {
  const [nodeId, setNodeId] = useState(tree.nodes[0]?.id);
  const node = tree.nodes.find((n) => n.id === nodeId) ?? tree.nodes[0];

  function advance(nextId?: string) {
    const next = nextId ? tree.nodes.find((n) => n.id === nextId) : undefined;
    if (!next) {
      onComplete();
      return;
    }
    setNodeId(next.id);
  }

  if (!node) {
    onComplete();
    return null;
  }

  return (
    // `fixed`, not `absolute` — the underlying game screen can be taller
    // than the viewport on narrow widths (SpankGame's two columns stack
    // below `lg`), and `main` doesn't scroll during a round. An `absolute`
    // overlay would inherit that oversized height and push this
    // bottom-anchored text off-screen with no way to reach it; `fixed`
    // always matches the actual viewport instead.
    <div className="fixed inset-0 z-40 flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        {node.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(165deg, ${accentColor ?? "#4c1d95"}, ${accentColor ?? "#4c1d95"}55 60%, #0a0a0a 100%)`,
            }}
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
      <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-10">
        {node.speaker && <Eyebrow>{node.speaker}</Eyebrow>}
        <p className="max-w-2xl text-base leading-relaxed text-neutral-100" data-testid="dialogue-text">
          {node.text}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {node.choices && node.choices.length > 0 ? (
            node.choices.map((c, i) => (
              <Button
                key={i}
                variant="secondary"
                onClick={() => advance(c.next)}
                data-testid={`dialogue-choice-${i}`}
              >
                {c.label}
              </Button>
            ))
          ) : (
            <Button onClick={() => advance(node.next)} data-testid="dialogue-advance">
              {node.next ? "Далее →" : "Начать →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
