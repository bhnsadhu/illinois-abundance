import { ArrowUpRight, MapPin } from '@/components/icons';
import { locationMapUrl } from '@/lib/location-links';

export function LocationLink({ location }: { location: string }) {
  const value = location.trim();
  if (!value) return null;
  const href = locationMapUrl(value);
  const label = /^https:\/\//i.test(value) && href ? 'View location in Maps' : value;

  return <p className="location-detail">
    <MapPin size={18} aria-hidden="true"/>
    {href ? <a className="location-link" href={href} target="_blank" rel="noopener noreferrer">
      <span>{label}</span><ArrowUpRight size={15} aria-hidden="true"/>
      <span className="sr-only"> (opens Maps in a new tab)</span>
    </a> : <span>{value}</span>}
  </p>;
}
