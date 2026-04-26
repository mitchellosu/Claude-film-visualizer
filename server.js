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

  'darkvu-10': `Edit only the window glass to simulate CoolVu DarkVu 15 ceramic window film installed on the home.

The surface must behave like real architectural glass with visible light reflection.

Target appearance:
- Deep charcoal-neutral tint (~15% VLT)
- Slight warm bronze undertone (very subtle — adds warmth without shifting the glass to brown)
- Noticeable but controlled reflectivity (clear reflections of sky and surroundings)
- Smooth glossy finish with defined specular highlights (light glints and sheen across the glass)
- High contrast against window frames for a premium upgraded look

Privacy effect:
- Interior visibility significantly reduced, but NOT solid black
- Maintain subtle depth inside the glass

Critical realism rules:
- Glass must show both reflection AND slight transparency
- Reflections should be crisp enough to read environment shapes, but not mirror-level
- Avoid matte, flat, or painted appearance
- Avoid chrome/mirror or overly metallic finishes

Color control:
- Bronze warmth should appear only as a slight tone shift in highlights and reflections
- Base tone remains charcoal-neutral
- No orange, copper, or heavy amber cast

Quality requirements:
- Uniform tint across all panes
- Clean edges and no distortion
- Reflections consistent with lighting direction and scene
- No haze, no patchiness

Goal:
Photorealistic tinted residential glass with a slightly reflective, high-end ceramic film look with a subtle warm bronze hue for added realism.

Do not modify anything except the glass.`,

  'dual-reflective-25': `Transform only the window glass on this home to showcase Dual Reflective 15 solar window film.

Create a premium reflective glass appearance with a sleek charcoal-silver finish that feels slightly lighter, cleaner, and more airy than a typical dark tint. The windows should look upgraded, modern, and high-performance without appearing too dark or heavy.

The finished glass should have:
- Medium charcoal-gray tone with a lighter, more refined brightness
- Reflective surface with clear mirrored reflections of sky, clouds, trees, and surroundings
- Subtle cool blue-gray daylight influence in reflections (very slight, not blue glass)
- Noticeable daytime privacy, but not blacked out
- Slight interior depth still visible through the glass
- Soft, airy visual quality rather than dense or heavy tint
- Consistent tint and reflectivity across all panes

Frame and divider protection:
- Keep all window frames, trim, mullions, and dividers perfectly crisp and unchanged
- Do not apply tint over frames or grid lines
- Preserve sharp edges and original colors of all non-glass elements

Critical balance:
- Reflection should be clear and natural, not overly dark
- Maintain brightness and light interaction so the glass feels realistic and breathable

Do not make the glass pure black. Do not make it strongly blue. Do not make it bronze. Do not change anything except the glass areas within the window panes.`,

  'darkvu-20': `Edit only the window glass on this home to simulate professionally installed CoolVu DarkVu 20 ceramic window film.

Strict masking rule:
- Apply changes ONLY to the glass areas
- Window frames, dividers (mullions), seals, and trim must remain completely unchanged, crisp, and fully visible

Material requirement:
- The glass must remain physically accurate (transparent + reflective), not solid, not painted, not matte

Visual appearance:
- Medium neutral charcoal tint (~25–30% VLT appearance, slightly lighter than standard 20%)
- Very subtle warm bronze undertone (extremely slight — neutral overall with a hint of warmth)
- Low-to-moderate reflectivity with visible natural reflections (sky, clouds, trees, surroundings)
- Subtle glossy surface with soft specular highlights
- Interior visibility slightly reduced but still present — faint depth visible

Glass realism:
- Maintain reflection + transparency + depth simultaneously
- Include realistic lighting gradients across each pane
- Keep a clean glass sheen (not flat, not dull)

Critical edge detail:
- Window frames and dividers must stay sharp, bright, and unaffected by tint
- No color spill, no darkening, no blurring of edges
- Maintain strong contrast between tinted glass and lighter frames

Avoid:
- Matte or flat black appearance
- Overly dark tint
- Tint bleeding onto frames or mullions
- Loss of edge definition

Ensure:
- All panes evenly tinted
- Reflections match outdoor lighting direction
- Result looks like real installed residential window film

Do not change anything except the glass.`,

  'ceramic-20': `Edit this exterior home photo to show the windows upgraded with professionally installed Dual Reflective 15 residential solar window film.

The glass should appear moderately dark, reflective, and high-contrast, similar to premium daytime privacy window film, but slightly lighter and more natural than a heavy tint. Use a neutral charcoal-gray / silver-black tone with a controlled mirror-like finish.

Visual characteristics:
- Approximately 20–25% visible light transmission appearance (slightly lighter than typical 15% film)
- Medium-dark tint, not overly heavy or blacked out
- Strong daytime privacy effect while still allowing subtle interior depth
- Reflective exterior surface showing realistic sky, cloud, tree, lawn, and nearby home reflections
- Slight silver-gray metallic sheen, not blue, not bronze
- Balanced brightness — glass should not appear too dark or dense
- Crisp contrast against the window frames and dividers
- Smooth, uniform tint across every pane

Critical realism rules:
- Maintain reflection + transparency + depth at the same time
- Do NOT make the glass look too dark or overly tinted
- Do NOT create a solid or heavy appearance

Keep the home, roof, brick, landscaping, driveway, people, vehicles, and camera angle unchanged. Only change the window glass. The result should look like a realistic customer preview for a high-end residential window film installation.`,
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
