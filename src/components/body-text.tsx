import { parseBody } from '@/lib/markdown';
export function BodyText({ body }: { body: string }) { return <div className="prose">{parseBody(body).map((block, i) => block.type === 'heading' ? <h2 key={i}>{block.text}</h2> : <p key={i}>{block.text}</p>)}</div>; }
