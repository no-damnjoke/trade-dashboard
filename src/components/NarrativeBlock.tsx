import './NarrativeBlock.css';

export function NarrativeBlock({ narrative }: { narrative: string }) {
  return (
    <div class="narrative-block">
      <span class="narrative-block__label">Market Narrative</span>
      <p class="narrative-block__text">{narrative}</p>
    </div>
  );
}
