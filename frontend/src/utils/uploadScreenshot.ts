import { supabase } from '../services/api.js';

const BUCKET = 'trade-screenshots';

export async function uploadScreenshot(
  dataUrl: string,
  userId: string,
): Promise<string> {
  // Strip the data URL prefix to get raw base64
  const [header, base64] = dataUrl.split(',');
  if (!base64) return dataUrl;

  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? 'image/png';
  const ext = mime.split('/')[1] ?? 'png';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    // Bucket may not exist yet — fall back to base64 so the image still shows
    // on this device. Create the bucket in the Supabase dashboard to enable
    // cross-device screenshots.
    console.warn('[uploadScreenshot] Storage upload failed, using base64 fallback:', error.message);
    return dataUrl;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
