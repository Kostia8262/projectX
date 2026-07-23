"use client";

import type { CharacterDefinition } from "@/lib/characters/registry";
import { SectionHeading, Eyebrow } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";

function renderBlocks(blocks: string[]) {
  return blocks.map((block, i) =>
    block.startsWith("## ") ? (
      <SectionHeading key={i} dense className="mt-2 text-fuchsia-300">
        {block.slice(3)}
      </SectionHeading>
    ) : (
      <p key={i} className="text-xs leading-relaxed text-neutral-300">
        {block}
      </p>
    )
  );
}

// Full-page counterpart to the "Её история" trigger on CharacterPage — a
// modal was too cramped to read a multi-scene backstory comfortably, so this
// gets its own view instead (see the "history" View kind in app/page.tsx).
// Stats/traits already live on CharacterPage one screen back — this page is
// just the read, split into her world (facts/relationships) on the left and
// the narrative hook (the scene-by-scene "Её история...") on the right,
// since they're different reading modes — reference vs. story.
export function CharacterHistoryPage({
  character,
  onBack,
}: {
  character: CharacterDefinition;
  onBack: () => void;
}) {
  const blocks = character.worldStory.split("\n\n");
  const storyStart = blocks.findIndex((b) => b.startsWith("## Её история"));
  const worldBlocks = storyStart === -1 ? blocks : blocks.slice(0, storyStart);
  const storyBlocks = storyStart === -1 ? [] : blocks.slice(storyStart);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-6">
      <button
        onClick={onBack}
        className="self-start text-sm text-neutral-400 transition hover:text-white"
      >
        ← {character.name}
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Card size="sm" data-testid="character-world">
          <Eyebrow>{character.name} · её мир</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">{renderBlocks(worldBlocks)}</div>
        </Card>

        <Card size="sm" data-testid="character-history">
          <Eyebrow>{character.name} · её история</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">{renderBlocks(storyBlocks)}</div>
        </Card>
      </div>
    </div>
  );
}
