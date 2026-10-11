import { useState } from "react";

interface SafetyGateProps {
  onAccept: () => void;
}

export function SafetyGate({ onAccept }: SafetyGateProps) {
  const [photo, setPhoto] = useState(false);
  const [selfUse, setSelfUse] = useState(false);

  return (
    <main className="gate">
      <section className="gate-card">
        <p className="eyebrow">Read this first</p>
        <h1>Photosensitive warning</h1>
        <p className="warn">
          This app cycles images on purpose. Flashing or patterned visuals can trigger seizures
          in people with photosensitive epilepsy and can bother migraines, vestibular issues,
          or light sensitivity. Default speed is slow (0.5 Hz). The hard cap is about 3 flashes
          per second. There is no stealth mode, no autoplay, and no hidden overlay — a session
          starts only after you click Start, and Stop stays on screen.
        </p>
        <p>
          Adult, self-use only. Do not run this at someone else, in public, or as a prank.
          Headphones are recommended for binaural beats. You can leave any time with Stop or
          the Escape key.
        </p>
        <label className="check">
          <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
          <span>I understand the seizure / light-sensitivity risk and the 3 Hz cap.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={selfUse} onChange={(e) => setSelfUse(e.target.checked)} />
          <span>This is for my own adult session. I will only start playback myself.</span>
        </label>
        <button className="btn primary" disabled={!photo || !selfUse} onClick={onAccept}>
          Continue to the studio
        </button>
      </section>
    </main>
  );
}
