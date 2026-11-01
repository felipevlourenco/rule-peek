export function App({ active }: { active: boolean }) {
  return (
    <div className="card primary-card unknown-class">
      <h2 className={`card__title ${active ? "legacy-box" : ""}`}>card</h2>
    </div>
  );
}
