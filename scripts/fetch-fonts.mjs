// Downloads Manjari, Chilanka and Gayathri (SIL OFL) into www/fonts so they work fully offline in the APK / EXE.
import { writeFile, mkdir } from 'node:fs/promises';
const base = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';
const files = [['manjari/Manjari-Regular.ttf', 'Manjari-Regular.ttf'], ['manjari/Manjari-Bold.ttf', 'Manjari-Bold.ttf'],
  ['chilanka/Chilanka-Regular.ttf', 'Chilanka-Regular.ttf'], ['gayathri/Gayathri-Regular.ttf', 'Gayathri-Regular.ttf'], ['gayathri/Gayathri-Bold.ttf', 'Gayathri-Bold.ttf']];
await mkdir('www/fonts', { recursive: true });
for (const [src, dst] of files) {
  try {
    const r = await fetch(base + src); if (!r.ok) throw new Error(r.status);
    await writeFile('www/fonts/' + dst, Buffer.from(await r.arrayBuffer())); console.log('ok  ', dst);
  } catch (e) { console.warn('SKIP', dst, String(e)); }
}
