'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReviewPost } from '@/lib/review-data';
import type { Topic, Writer, Source } from '@/lib/types';
import { ArrowUpRight } from '@/components/icons';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function ReviewEditor({ post, topics, writers }: { post: ReviewPost; topics: Topic[]; writers: Writer[] }) {
  const router = useRouter();
  const [version, setVersion] = useState(post.version);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(post.status);
  const [slug, setSlug] = useState(post.slug);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [cover, setCover] = useState(post.cover_url);
  const [alt, setAlt] = useState(post.cover_alt || '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function markDirty() {
    if (!dirty) setVersion(Math.max(version, post.version));
    setDirty(true);
  }

  function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError('');
    setPhotoError('');
    setMessage('');
    if (selected.size > 4 * 1024 * 1024 || !photoTypes.includes(selected.type)) {
      setPhotoError(selected.size > 4 * 1024 * 1024 ? 'Keep your photo under 4 MB.' : 'Choose a JPG, PNG, WebP, or AVIF photo.');
      event.target.value = '';
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setAlt('');
    markDirty();
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
    setCover(null);
    setAlt('');
    if (fileInput.current) fileInput.current.value = '';
    setError('');
    setPhotoError('');
    setMessage('The topic illustration will be used when you save or publish.');
    markDirty();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value || 'save';
    const savesContent = action === 'save' || action === 'publish';
    const data = new FormData(event.currentTarget);
    setBusy(action);
    setError('');
    setPhotoError('');
    setMessage('');
    let uploading = false;
    try {
      const sources: Source[] = String(savesContent ? data.get('sources') || '' : '').split('\n').filter(line => line.trim()).map(line => {
        const split = line.indexOf('|');
        if (split < 1) throw new Error('Write each source as a title, then |, then its link.');
        return { label: line.slice(0, split).trim(), url: line.slice(split + 1).trim() };
      });
      let photoUrl = cover;
      const photoAlt = alt.trim();
      if (savesContent && (file || cover) && !photoAlt) {
        setPhotoError('Describe the photo so everyone can understand it.');
        altInput.current?.focus();
        return;
      }
      if (savesContent && file) {
        setBusy('upload');
        uploading = true;
        const body = new FormData();
        body.set('file', file);
        body.set('alt', photoAlt);
        const response = await fetch('/api/covers', { method: 'POST', body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'We couldn’t upload that photo. Please try again.');
        uploading = false;
        photoUrl = result.url;
        // Keep the successful upload if saving fails, so retrying does not upload twice.
        setCover(photoUrl);
        setFile(null);
        setPreview(null);
        if (fileInput.current) fileInput.current.value = '';
        setBusy(action);
      }
      const changes = {
        headline: data.get('headline'), short_version: data.get('short_version'), final_body: data.get('final_body'),
        topic_id: data.get('topic_id') || null, byline: data.get('byline'), writer_id: data.get('writer_id') || null,
        sources, cover_url: photoUrl, cover_alt: photoUrl ? photoAlt : null, decline_note: note,
      };
      const response = await fetch(`/api/review/${post.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, version: dirty ? version : Math.max(version, post.version), changes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We couldn’t save that change.');
      setVersion(result.version);
      // Declining or unpublishing leaves local content edits unsaved.
      if (savesContent) setDirty(false);
      setSlug(result.slug);
      setStatus(result.status);
      setMessage(action === 'publish' ? 'Published. Your piece is ready to share.'
        : action === 'unpublish' ? 'The piece is no longer public. Its original is safely kept.'
        : action === 'decline' ? 'Marked declined. No email was sent.' : 'Your changes are saved.');
      router.refresh();
    } catch (error) {
      const feedback = error instanceof Error ? error.message : 'Please try again.';
      if (uploading) setPhotoError(feedback);
      else setError(feedback);
    } finally { setBusy(''); }
  }

  const photo = preview || cover;
  return <form onChange={markDirty} onSubmit={save} className="editor-form" aria-busy={Boolean(busy)}>
    <fieldset className="editor-fields" disabled={Boolean(busy)}>
      <section className="editor-photo" aria-labelledby="photo-heading">
        <div className="editor-photo-settings">
          <h2 id="photo-heading">Post photo <span className="muted">Optional</span></h2>
          <p className="field-hint" id="photo-hint">Appears at the top of your post and in story previews. Leave it empty to use the topic illustration.</p>
          <label>Choose a photo<input ref={fileInput} type="file" accept={photoTypes.join(',')} onChange={selectPhoto} aria-describedby="photo-hint photo-formats"/></label>
          <p className="field-hint" id="photo-formats">JPG, PNG, WebP, or AVIF. Up to 4 MB.</p>
          <label hidden={!photo}>Describe the photo<input ref={altInput} value={alt} onChange={event => { setAlt(event.target.value); setPhotoError(''); }} maxLength={300} placeholder="What’s in the photo?" aria-describedby="photo-alt-hint"/></label>
          {photo && <p className="field-hint" id="photo-alt-hint">A short description for people who use a screen reader.</p>}
          <p className="field-hint" role="status">{busy === 'upload' ? 'Uploading your photo…' : file ? 'Photo selected. It will upload when you save or publish.' : photo ? 'This photo will appear above your story.' : 'Using the topic illustration.'}</p>
          {photoError && <p className="alert alert-error" role="alert">{photoError}</p>}
          {photo && <button className="text-button" type="button" onClick={removePhoto}>Remove photo</button>}
        </div>
        {photo && <div className="cover-preview"><Image src={photo} width={800} height={560} alt={alt || 'Selected post photo preview'} unoptimized/></div>}
      </section>
      <div className="editor-grid">
        <div><label>Final version<textarea name="final_body" defaultValue={post.final_body} rows={22} maxLength={30000}/></label><p className="field-hint">Blank lines make paragraphs. Start a subhead with ##. HTML is displayed as text.</p></div>
        <div className="editor-settings">
          <label>Headline<input name="headline" defaultValue={post.headline} maxLength={200}/></label>
          <label>Short version<textarea name="short_version" defaultValue={post.short_version} rows={4} maxLength={600}/><span className="field-hint">Two plain sentences that give readers the idea.</span></label>
          <label>Topic<select name="topic_id" defaultValue={post.topic_id || ''}><option value="">Choose a topic</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
          <label>Byline<input name="byline" defaultValue={post.byline || post.author_name} maxLength={160}/></label>
          <label>Writer<select name="writer_id" defaultValue={post.writer_id || ''}><option value="">Match by email or create a writer</option>{writers.map(writer => <option key={writer.id} value={writer.id}>{writer.name}</option>)}</select></label>
        </div>
      </div>
      <label>Sources<textarea name="sources" defaultValue={post.sources.map(source => `${source.label} | ${source.url}`).join('\n')} rows={4}/><span className="field-hint">One per line: Source title | https://example.org</span></label>
      <details className="internal-note"><summary>Internal decline note</summary><label><span className="sr-only">Internal note</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3}/></label><p className="field-hint">Reviewers only. This note is never emailed or published.</p></details>
    </fieldset>
    <div className="editor-messages" aria-live="polite">
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {message && <p className="alert" role="status">{message} {status === 'published' && slug && <Link className="text-link" href={`/post/${slug}`}>Read the piece <ArrowUpRight size={15}/></Link>}</p>}
    </div>
    <div className="editor-actions">
      <div>
        <button name="action" value="save" className="button button-outline" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
        <button name="action" value="decline" className="text-button" disabled={Boolean(busy)}>Decline</button>
        {status === 'published' && <button name="action" value="unpublish" className="text-button" disabled={Boolean(busy)}>Unpublish</button>}
      </div>
      <button name="action" value="publish" className="button" disabled={Boolean(busy)}>{busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Publish changes' : 'Publish piece'}<ArrowUpRight size={18}/></button>
    </div>
  </form>;
}
