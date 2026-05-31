import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// ─── Film metadata ───────────────────────────────────────────────────────────
const FILM_NAMES = {
  'dual-reflective-15': 'Dual Reflective 15',
  'darkvu-10':          'DarkVu 10',
  'darkvu-20':          'DarkVu 20',
  'dual-reflective-25': 'Dual Reflective 25',
  'ceramic-20':         'Ceramic 20',
};

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

// ─── Clients ──────────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const anthropic =
  process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

// Gmail OAuth2 client — only active when credentials are present
let gmail = null;
if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
  const gmailAuth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  gmailAuth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  gmail = google.gmail({ version: 'v1', auth: gmailAuth });
}

const STORAGE_BUCKET = 'coolvu-visualization';

// ─── Newsletter helpers ───────────────────────────────────────────────────────

// Pre-mapped sender → category (avoids API calls for known newsletters)
const SENDER_CATEGORIES = {
  'dumbzone+the-dumb-zone@substack.com':    'Sports',
  'numlock@substack.com':                   'Sports',
  'nanewsletter@nashownotes.com':           'Sports',
  'twiai@substack.com':                     'Tech & AI',
  'agentai@mail.beehiiv.com':               'Tech & AI',
  'list@ben-evans.com':                     'Tech & AI',
  'no-reply@notification.circle.so':        'Tech & AI',
  'nick+news@leftclick.ai':                 'Tech & AI',
  'hi@mikefutia.com':                       'Tech & AI',
  'ownedoperatedinsights@mail.beehiiv.com': 'Business',
  'openresidency@mail.beehiiv.com':         'Business',
  'cheapsoftwarestocks@substack.com':       'Business',
  'wyatt@alts.co':                          'Business',
  'cffp@email.kaplanprofessional.com':      'Business',
  'sandcastles-0faa9b@mail.beehiiv.com':    'Business',
  'james@theadvisorcoach.com':              'Business',
  'austin@ownrops.com':                     'Business',
  'howiwrite@substack.com':                 'Create',
  'matterreader@substack.com':              'Create',
  'wavy@mail.beehiiv.com':                  'Create',
  'hypefury@mail.beehiiv.com':              'Create',
  'kevin@kevinbellco.com':                  'Create',
  'marketing-examined@mail.beehiiv.com':    'Create',
  'new-era-calum-johnson-show@mail.beehiiv.com': 'Create',
  'gael@authorityhacker.com':               'Create',
  'newsletter@midwayhollowcrimewatch.com':  'Local',
  'stephanie@pinkston-harris.com':          'Local',
  'ScissorsScotch@marketing.mytime.com':    'Local',
};

function parseSender(fromHeader) {
  if (!fromHeader) return { name: '', email: '' };
  const match = fromHeader.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
  if (!match) return { name: '', email: fromHeader.trim() };
  const name = match[1].trim().replace(/^"|"$/g, '');
  const email = match[2].trim() || fromHeader.trim();
  return { name, email };
}

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractHtmlBody(payload) {
  if (!payload) return null;
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractHtmlBody(part);
      if (result) return result;
    }
  }
  return null;
}

function extractTextBody(payload) {
  if (!payload) return null;
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractTextBody(part);
      if (result) return result;
    }
  }
  return null;
}

async function categorizeBatch(items) {
  if (!anthropic || items.length === 0) return;

  const prompt = items.map((item, i) =>
    `${i + 1}. From: "${item.sender_name}" <${item.sender_email}>\n   Subject: ${item.subject}\n   Snippet: ${item.snippet.slice(0, 120)}`
  ).join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Categorize each newsletter into exactly one category: Sports, Tech & AI, Business, Create, or Local.

Sports = sports, games, entertainment, humor, memes, pop culture
Tech & AI = technology, AI, software, startups, product launches
Business = entrepreneurship, investing, finance, marketing, operations
Create = writing, design, content creation, personal growth, craft
Local = local news, neighborhood, community, regional

Respond with ONLY a JSON array in order: [{"id":"...","category":"..."},...]

Newsletters:
${prompt}`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return;

  const results = JSON.parse(jsonMatch[0]);
  const VALID = new Set(['Sports', 'Tech & AI', 'Business', 'Create', 'Local']);

  for (const r of results) {
    const idx = Number(r.id) - 1;
    if (idx >= 0 && idx < items.length && VALID.has(r.category)) {
      items[idx]._category = r.category;
    }
  }
}

// ─── Gallery helpers ──────────────────────────────────────────────────────────
async function saveToGallery(id, filmId, originalBuffer, resultBuffer) {
  await Promise.all([
    supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${id}/original.png`, originalBuffer, { contentType: 'image/png' }),
    supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${id}/result.png`, resultBuffer, { contentType: 'image/png' }),
  ]);

  const originalUrl = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(`${id}/original.png`).data.publicUrl;
  const resultUrl = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(`${id}/result.png`).data.publicUrl;

  const { error } = await supabase.from('visualizations').insert({
    id,
    film_id: filmId,
    film_name: FILM_NAMES[filmId] ?? filmId,
    original_url: originalUrl,
    result_url: resultUrl,
  });

  if (error) throw error;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post('/api/visualize', upload.single('image'), async (req, res) => {
  const { filmId } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No image provided.' });
  if (!filmId || !FILM_PROMPTS[filmId]) return res.status(400).json({ error: 'Invalid film selection.' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY.' });

  try {
    // Convert to square RGB PNG for OpenAI
    const { width, height } = await sharp(req.file.buffer).metadata();
    const size = Math.min(Math.max(width ?? 1024, height ?? 1024), 1024);
    const pngBuffer = await sharp(req.file.buffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png({ compressionLevel: 7 })
      .toBuffer();

    const imageFile = await toFile(pngBuffer, 'house.png', { type: 'image/png' });

    const response = await openai.images.edit({
      model: 'gpt-image-2',
      image: imageFile,
      prompt: FILM_PROMPTS[filmId],
      n: 1,
      size: '1024x1024',
    });

    const item = response.data[0];
    const imageDataUrl = item.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item.url;

    const id = randomUUID();
    res.json({ success: true, image: imageDataUrl, id });

    // Save to gallery in background — don't block the response
    if (supabase && item.b64_json) {
      const resultBuffer = Buffer.from(item.b64_json, 'base64');
      saveToGallery(id, filmId, pngBuffer, resultBuffer).catch((err) =>
        console.error('Gallery save failed:', err?.message)
      );
    }
  } catch (err) {
    console.error('OpenAI error:', err?.message ?? err);
    res.status(500).json({ error: err?.error?.message ?? err?.message ?? 'Generation failed.' });
  }
});

app.get('/api/gallery', async (req, res) => {
  if (!supabase) return res.json({ items: [] });

  const { filmId, limit = 60, offset = 0 } = req.query;

  let query = supabase
    .from('visualizations')
    .select('id, film_id, film_name, original_url, result_url, created_at')
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (filmId) query = query.eq('film_id', filmId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data ?? [] });
});

// ─── Newsletter routes ────────────────────────────────────────────────────────

// POST /api/newsletters/sync — fetch latest threads from Gmail, cache in Supabase
app.post('/api/newsletters/sync', async (req, res) => {
  if (!gmail)  return res.status(503).json({ error: 'Gmail not configured.' });
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });

  try {
    const { pageToken } = req.body ?? {};

    // Fetch thread list (metadata only — fast)
    const listRes = await gmail.users.threads.list({
      userId: 'me',
      maxResults: 100,
      pageToken: pageToken || undefined,
      q: 'label:Label_8322070601344068830 OR (has:list-unsubscribe -from:me)',
    });

    const threads = listRes.data.threads ?? [];
    const nextPageToken = listRes.data.nextPageToken ?? null;

    if (threads.length === 0) {
      return res.json({ synced: 0, skipped: 0, nextPageToken });
    }

    // Collect all message IDs we already have
    const threadIds = threads.map((t) => t.id);
    const { data: existing } = await supabase
      .from('newsletters')
      .select('gmail_message_id')
      .in('gmail_message_id', threadIds);

    const existingIds = new Set((existing ?? []).map((r) => r.gmail_message_id));

    const newThreadIds = threadIds.filter((id) => !existingIds.has(id));
    let synced = 0;

    if (newThreadIds.length > 0) {
      // Fetch metadata for new threads in parallel (capped at 20 at a time)
      const BATCH = 20;
      const newItems = [];

      for (let i = 0; i < newThreadIds.length; i += BATCH) {
        const batch = newThreadIds.slice(i, i + BATCH);
        const fetched = await Promise.all(
          batch.map((id) =>
            gmail.users.threads.get({
              userId: 'me',
              id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date'],
            }).then((r) => r.data).catch(() => null)
          )
        );

        for (const thread of fetched) {
          if (!thread) continue;
          const msg = thread.messages?.[0];
          if (!msg) continue;

          const headers = {};
          for (const h of msg.payload?.headers ?? []) {
            headers[h.name.toLowerCase()] = h.value;
          }

          const { name: senderName, email: senderEmail } = parseSender(headers['from'] ?? '');
          const subject = headers['subject'] ?? '(no subject)';
          const receivedAt = new Date(Number(msg.internalDate)).toISOString();
          const snippet = (msg.snippet ?? '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

          const category = SENDER_CATEGORIES[senderEmail] ?? null;

          newItems.push({
            gmail_message_id: thread.id,
            sender_email: senderEmail,
            sender_name: senderName || senderEmail.split('@')[0],
            subject,
            snippet,
            received_at: receivedAt,
            category,
            _category: category, // placeholder for AI categorization
          });
        }
      }

      // AI-categorize any that didn't match the known-sender map
      const uncategorized = newItems.filter((it) => !it.category);
      if (uncategorized.length > 0 && anthropic) {
        const CLAUDE_BATCH = 20;
        for (let i = 0; i < uncategorized.length; i += CLAUDE_BATCH) {
          const slice = uncategorized.slice(i, i + CLAUDE_BATCH);
          // Pass 1-based index as id for mapping
          const indexed = slice.map((item, idx) => ({ ...item, id: String(idx + 1) }));
          await categorizeBatch(indexed).catch(() => {});
          for (let j = 0; j < slice.length; j++) {
            slice[j].category = indexed[j]._category ?? null;
          }
        }
      }

      // Upsert newsletters
      const rows = newItems.map(({ _category, ...item }) => item);
      const { error: insertErr } = await supabase
        .from('newsletters')
        .upsert(rows, { onConflict: 'gmail_message_id' });

      if (insertErr) throw insertErr;
      synced = rows.length;

      // Update newsletter_senders aggregate
      const senderMap = {};
      for (const item of newItems) {
        if (!senderMap[item.sender_email]) {
          senderMap[item.sender_email] = {
            email: item.sender_email,
            display_name: item.sender_name,
            last_seen: item.received_at,
            primary_category: item.category,
            _count: 0,
          };
        }
        const s = senderMap[item.sender_email];
        s._count++;
        if (item.received_at > s.last_seen) s.last_seen = item.received_at;
      }

      // Fetch current counts to add to
      const senderEmails = Object.keys(senderMap);
      const { data: existingSenders } = await supabase
        .from('newsletter_senders')
        .select('email, total_count, unread_count')
        .in('email', senderEmails);

      const existingSenderMap = {};
      for (const s of existingSenders ?? []) existingSenderMap[s.email] = s;

      const senderRows = Object.values(senderMap).map((s) => {
        const prev = existingSenderMap[s.email];
        return {
          email: s.email,
          display_name: s.display_name,
          last_seen: s.last_seen,
          primary_category: s.primary_category,
          total_count: (prev?.total_count ?? 0) + s._count,
          unread_count: (prev?.unread_count ?? 0) + s._count,
        };
      });

      await supabase
        .from('newsletter_senders')
        .upsert(senderRows, { onConflict: 'email' });
    }

    res.json({ synced, skipped: threads.length - newThreadIds.length, nextPageToken });
  } catch (err) {
    console.error('Newsletter sync error:', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Sync failed.' });
  }
});

// GET /api/newsletters — list senders + filtered newsletter cards
app.get('/api/newsletters', async (req, res) => {
  if (!supabase) return res.json({ senders: [], newsletters: [], total: 0 });

  const { senderEmail, category, isRead, limit = 50, offset = 0 } = req.query;

  const [sendersResult, newslettersResult] = await Promise.all([
    supabase
      .from('newsletter_senders')
      .select('email, display_name, unread_count, total_count, primary_category')
      .order('last_seen', { ascending: false })
      .limit(200),

    (() => {
      let q = supabase
        .from('newsletters')
        .select('id, gmail_message_id, sender_email, sender_name, subject, snippet, received_at, category, is_read', { count: 'exact' })
        .order('received_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (senderEmail) q = q.eq('sender_email', senderEmail);
      if (category)    q = q.eq('category', category);
      if (isRead !== undefined) q = q.eq('is_read', isRead === 'true');

      return q;
    })(),
  ]);

  res.json({
    senders: sendersResult.data ?? [],
    newsletters: newslettersResult.data ?? [],
    total: newslettersResult.count ?? 0,
  });
});

// GET /api/newsletters/:messageId — lazy-load full body
app.get('/api/newsletters/:messageId', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { messageId } = req.params;

  const { data: row, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('gmail_message_id', messageId)
    .single();

  if (error || !row) return res.status(404).json({ error: 'Newsletter not found.' });

  if (row.full_content_fetched) return res.json(row);

  if (!gmail) return res.json(row); // return metadata even without Gmail

  try {
    const threadData = await gmail.users.threads.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const msg = threadData.data.messages?.at(-1);
    const bodyHtml = msg ? extractHtmlBody(msg.payload) : null;
    const bodyText = msg ? extractTextBody(msg.payload) : null;

    const { data: updated } = await supabase
      .from('newsletters')
      .update({ body_html: bodyHtml, full_content_fetched: true })
      .eq('gmail_message_id', messageId)
      .select()
      .single();

    res.json(updated ?? { ...row, body_html: bodyHtml, body_text: bodyText });
  } catch (err) {
    console.error('Newsletter body fetch error:', err?.message);
    res.json(row); // fall back to metadata
  }
});

// PATCH /api/newsletters/:messageId/read — mark as read
app.patch('/api/newsletters/:messageId/read', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { messageId } = req.params;

  const { data: row } = await supabase
    .from('newsletters')
    .select('sender_email, is_read')
    .eq('gmail_message_id', messageId)
    .single();

  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.is_read) return res.json({ ok: true }); // already read

  // Fetch current unread count then decrement
  const { data: senderRow } = await supabase
    .from('newsletter_senders')
    .select('unread_count')
    .eq('email', row.sender_email)
    .single();

  const newCount = Math.max((senderRow?.unread_count ?? 1) - 1, 0);

  await Promise.all([
    supabase.from('newsletters').update({ is_read: true }).eq('gmail_message_id', messageId),
    supabase.from('newsletter_senders').update({ unread_count: newCount }).eq('email', row.sender_email),
  ]);

  res.json({ ok: true });
});

// ─── Static (production) ──────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  );
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`CoolVu server → http://localhost:${PORT}`));
