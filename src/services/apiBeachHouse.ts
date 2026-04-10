import imageCompression from 'browser-image-compression';
import supabase from './supabase';

const STORAGE_BUCKET = 'beach-house-images';
const MAX_SIZE_MB = 0.3; // 300 KB

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadBeachHouseImage(file: File): Promise<string> {
  // Compress to ≤ 300 KB before upload
  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
  });

  const ext = 'webp';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, compressed, { contentType: 'image/webp', upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteBeachHouseImageFromStorage(
  imageUrl: string,
): Promise<void> {
  // Extract the storage path from the public URL
  const url = new URL(imageUrl);
  const pathParts = url.pathname.split(`/${STORAGE_BUCKET}/`);
  if (pathParts.length < 2) return; // not a storage URL, skip
  const storagePath = pathParts[1];

  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  // Ignore errors — DB row will be deleted regardless
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BeachHouseImage {
  id: string;
  beach_house_id: string;
  image_url: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BeachHouse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  address: string | null;
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price_per_night: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  amenities: string[];
  is_active: boolean;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined from beach_house_images
  images?: BeachHouseImage[];
}

export interface CreateBeachHouseInput {
  name: string;
  slug: string;
  description?: string;
  location?: string;
  address?: string;
  max_guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  price_per_night?: number;
  check_in_time?: string;
  check_out_time?: string;
  amenities?: string[];
  is_active?: boolean;
}

export type UpdateBeachHouseInput = Partial<CreateBeachHouseInput> & {
  cover_image_id?: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBeachHouses(): Promise<BeachHouse[]> {
  const { data, error } = await supabase
    .from('beach_houses')
    .select('*, images:beach_house_images!beach_house_id(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BeachHouse[];
}

export async function getBeachHouse(id: string): Promise<BeachHouse> {
  const { data, error } = await supabase
    .from('beach_houses')
    .select('*, images:beach_house_images!beach_house_id(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as BeachHouse;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createBeachHouse(
  input: CreateBeachHouseInput,
): Promise<BeachHouse> {
  const { data, error } = await supabase
    .from('beach_houses')
    .insert({
      ...input,
      amenities: input.amenities ?? [],
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BeachHouse;
}

export async function updateBeachHouse({
  id,
  ...input
}: UpdateBeachHouseInput & { id: string }): Promise<BeachHouse> {
  const { data, error } = await supabase
    .from('beach_houses')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BeachHouse;
}

export async function deleteBeachHouse(id: string): Promise<void> {
  const { error } = await supabase.from('beach_houses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Image mutations ───────────────────────────────────────────────────────────

export async function addBeachHouseImage({
  beachHouseId,
  file,
  position,
}: {
  beachHouseId: string;
  file: File;
  position: number;
}): Promise<BeachHouseImage> {
  const imageUrl = await uploadBeachHouseImage(file);

  const { data, error } = await supabase
    .from('beach_house_images')
    .insert({ beach_house_id: beachHouseId, image_url: imageUrl, position })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BeachHouseImage;
}

export async function deleteBeachHouseImage({
  imageId,
  imageUrl,
}: {
  imageId: string;
  imageUrl: string;
}): Promise<void> {
  // Delete from storage first (ignore errors), then remove DB row
  await deleteBeachHouseImageFromStorage(imageUrl);

  const { error } = await supabase
    .from('beach_house_images')
    .delete()
    .eq('id', imageId);
  if (error) throw new Error(error.message);
}

// Upload multiple files and insert rows in one go (used by create flow)
export async function uploadAndSaveImages(
  beachHouseId: string,
  files: File[],
): Promise<BeachHouseImage[]> {
  const results: BeachHouseImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const row = await addBeachHouseImage({
      beachHouseId,
      file: files[i],
      position: i,
    });
    results.push(row);
  }
  return results;
}

export async function setCoverImage({
  beachHouseId,
  imageId,
}: {
  beachHouseId: string;
  imageId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('beach_houses')
    .update({ cover_image_id: imageId })
    .eq('id', beachHouseId);
  if (error) throw new Error(error.message);
}

export async function updateImagePositions(
  updates: { id: string; position: number }[],
): Promise<void> {
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('beach_house_images').update({ position }).eq('id', id),
    ),
  );
}
