// Shared by SpankGame and SpankGameRate's tap button — both derive the same
// gradient from the selected implement's color, falling back to a flat gray
// when nothing is selected yet.
export function spankButtonBackground(color: string | undefined): string {
  return color ? `linear-gradient(135deg, ${color}, #6366f1)` : "#333";
}
