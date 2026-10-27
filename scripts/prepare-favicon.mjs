// Render the code-native handwritten I at the sizes used by browsers and devices.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = new URL('../public/brand/', import.meta.url);
const source = await readFile(new URL('favicon.svg', directory));
for (const [size, name] of [[32, 'favicon.png'], [180, 'apple-touch-icon.png'], [192, 'favicon-192.png'], [512, 'favicon-512.png']]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(name, directory)));
}

// ICO permits PNG entries, keeping the same artwork in legacy browser fallbacks.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
});
await writeFile(new URL('favicon.ico', directory), Buffer.concat([header, ...images]));
