import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const FILM_PROMPTS = {
  'darkvu-20': [
    'You are editing a photo of a residential home.',
    'Apply realistic deep charcoal ceramic window tint film (DarkVu 20) to ALL visible windows in the image.',
    'The windows should appear nearly black and nearly opaque from the outside — similar to very dark limousine tint.',
    'The film has a sleek, modern appearance with a slight sheen.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),

  'coolvu-35': [
    'You are editing a photo of a residential home.',
    'Apply realistic medium charcoal ceramic window tint film (CoolVu 35) to ALL visible windows in the image.',
    'The windows should appear dark gray/charcoal from the outside — good privacy while still allowing some diffused light.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),

  'coolvu-50': [
    'You are editing a photo of a residential home.',
    'Apply realistic light smoke ceramic window tint film (CoolVu 50) to ALL visible windows in the image.',
    'The windows should appear lightly tinted with a subtle gray/smoke effect — the tint is noticeable but still relatively transparent.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),

  'carbon-bronze': [
    'You are editing a photo of a residential home.',
    'Apply realistic warm bronze carbon window tint film to ALL visible windows in the image.',
    'The windows should appear with a warm amber/bronze tone — a classic, elegant look that gives the glass a golden-brown color cast.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),

  'reflective-silver': [
    'You are editing a photo of a residential home.',
    'Apply realistic mirror-like reflective silver window film to ALL visible windows in the image.',
    'The windows should appear highly reflective like polished mirrors from the outside, showing soft reflections of the sky and surroundings.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),

  'clear-safety': [
    'You are editing a photo of a residential home.',
    'Apply clear safety window film to ALL visible windows in the image.',
    'The windows should appear crystal clear with absolutely no visible tint — maintaining the natural appearance of the glass.',
    'Do not change anything else: keep the house walls, roof, landscaping, driveway, sky, and all surroundings exactly the same.',
    'Photorealistic result — it should look like the film was professionally installed.',
  ].join(' '),
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/visualize', upload.single('image'), async (req, res) => {
  const { filmId } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No image provided.' });
  }
  if (!filmId || !FILM_PROMPTS[filmId]) {
    return res.status(400).json({ error: 'Invalid film selection.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY.' });
  }

  try {
    const imageFile = await toFile(
      req.file.buffer,
      req.file.originalname || 'house.jpg',
      { type: req.file.mimetype }
    );

    const response = await openai.images.edit({
      model: 'gpt-image-2',
      image: imageFile,
      prompt: FILM_PROMPTS[filmId],
      n: 1,
      size: '1024x1024',
    });

    const item = response.data[0];
    const image = item.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item.url;

    res.json({ success: true, image });
  } catch (err) {
    console.error('OpenAI error:', err?.message ?? err);
    const message = err?.error?.message ?? err?.message ?? 'Generation failed.';
    res.status(500).json({ error: message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  );
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`CoolVu server → http://localhost:${PORT}`));
