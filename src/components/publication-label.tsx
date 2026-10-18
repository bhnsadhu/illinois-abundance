export function PublicationLabel({ sample }: { sample: boolean }) {
  return <span className={sample ? 'sample-label' : 'publication-label'}>
    {sample ? 'Sample story' : 'Published by Illinois Abundance'}
  </span>;
}
