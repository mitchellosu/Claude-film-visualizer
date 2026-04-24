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
  'dual-reflective-15': `Transform only the window glass on this home to showcase Dual Reflective 15 solar window film.

Create a premium dark reflective glass appearance with a sleek charcoal-silver mirror finish. The windows should look noticeably upgraded, modern, and high-performance, creating strong daytime privacy from the exterior.

The finished glass should have:
- Deep charcoal-gray tint
- Reflective silver-black surface
- Clear mirrored reflections of sky, clouds, trees, lawn, and surrounding homes
- Very low interior visibility from outside
- Strong contrast with white or light-colored window frames
- Consistent darkness and reflectivity on all window panes
- No haze, no distortion, no uneven patches

Do not make the glass pure black. Do not make it blue. Do not make it bronze. Do not change the house, trim, roof, landscaping, lighting, vehicles, or background. Keep the image photorealistic, like a professional before-and-after preview for a residential window tinting company.`,
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
