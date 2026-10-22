'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, MapPin } from '@/components/icons';
import { locationMapUrl } from '@/lib/location-links';

export function AdminLocationField({ name, label, defaultValue = '', required, maxLength = 300 }: {
  name: string; label: string; defaultValue?: string; required?: boolean; maxLength?: number;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const href = locationMapUrl(value);

  return <div className="location-field">
    <label htmlFor={id}>{label}</label>
    <div className="location-input">
      <MapPin size={18} aria-hidden="true"/>
      <input id={id} name={name} value={value} onChange={event => setValue(event.target.value)}
        required={required} maxLength={maxLength} aria-describedby={`${id}-hint`}
        placeholder="Venue, street address, city"/>
    </div>
    <p id={`${id}-hint`} className="field-hint">Add the venue and city, or paste a Maps link. Include the room if needed.</p>
    {href && <a className="text-link location-preview" href={href} target="_blank" rel="noopener noreferrer">
      Check location in Maps <ArrowUpRight size={15} aria-hidden="true"/>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>}
  </div>;
}
