// Quick test: run Apify Facebook Ad Library scraper and dump results
// Set APIFY_API_TOKEN in your .env or environment before running
const TOKEN = process.env.APIFY_API_TOKEN;
if (!TOKEN) { console.error('Set APIFY_API_TOKEN in your environment'); process.exit(1); }
const BASE  = 'https://api.apify.com/v2';

// Facebook Ad Library search URL for the competitor page
const searchUrl =
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US' +
  '&q=Green+Valley+Window+Tint&search_type=page';

console.log('Starting Apify run...');
const startRes = await fetch(
  `${BASE}/acts/apify~facebook-ads-scraper/runs?token=${TOKEN}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls: [{ url: searchUrl }],
      maxResults: 20,
    }),
  }
);

if (!startRes.ok) {
  const err = await startRes.text();
  console.error('Failed to start run:', startRes.status, err);
  process.exit(1);
}

const { data: run } = await startRes.json();
console.log(`Run ID: ${run.id}  |  Status: ${run.status}`);
console.log(`View at: https://console.apify.com/actors/runs/${run.id}`);

// Poll until done
let status = run.status;
let attempts = 0;
while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status) && attempts < 40) {
  await new Promise(r => setTimeout(r, 5000));
  attempts++;
  const pollRes = await fetch(`${BASE}/actor-runs/${run.id}?token=${TOKEN}`);
  const { data } = await pollRes.json();
  status = data.status;
  console.log(`[${attempts * 5}s] Status: ${status}`);
}

if (status !== 'SUCCEEDED') {
  console.error('Run did not succeed:', status);
  process.exit(1);
}

// Fetch dataset items
const itemsRes = await fetch(
  `${BASE}/actor-runs/${run.id}/dataset/items?token=${TOKEN}&clean=true`
);
const items = await itemsRes.json();

console.log(`\n=== ${items.length} ads found ===\n`);

items.slice(0, 5).forEach((item, i) => {
  console.log(`--- Ad ${i + 1} ---`);
  console.log('Page:', item.pageName ?? item.page_name ?? 'n/a');
  console.log('Active:', item.isActive ?? item.is_active ?? 'n/a');
  console.log('Start date:', item.startDate ?? 'n/a');
  console.log('Title:', item.snapshot?.title ?? item.title ?? 'n/a');
  const body = item.snapshot?.body?.text ?? item.snapshot?.body?.markup?.__html ?? item.body ?? '';
  console.log('Body:', body.slice(0, 120));
  const images = (item.snapshot?.images ?? []).map(img => img.resized_image_url ?? img.original_image_url).filter(Boolean);
  console.log('Images:', images.length, images[0] ? `(first: ${images[0].slice(0, 80)}...)` : '');
  const videos = (item.snapshot?.videos ?? []).map(v => v.video_hd_url ?? v.video_sd_url).filter(Boolean);
  console.log('Videos:', videos.length);
  console.log();
});

if (items.length > 5) console.log(`... and ${items.length - 5} more ads.`);
console.log('\nFull raw first item:');
console.log(JSON.stringify(items[0], null, 2));
