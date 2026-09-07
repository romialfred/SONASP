/** The production deterministic renderer, supplied exclusively with local QA data. */
import { generateAffiliationFiles } from '../../supabase/functions/affiliation-card-render/render-files.ts';
const [inputPath, outputPath] = Deno.args;
const input = JSON.parse(await Deno.readTextFile(inputPath));
const portrait = await Deno.readFile(new URL('./portrait.png', import.meta.url));
const files = await generateAffiliationFiles(input, portrait, 'image/png', 'https://verification.example.test');
await Deno.mkdir(outputPath, { recursive: true });
for (const [face, bytes] of Object.entries(files)) await Deno.writeFile(`${outputPath}/${face}.${face === 'pdf' ? 'pdf' : 'png'}`, bytes);
