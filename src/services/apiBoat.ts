import imageCompression from 'browser-image-compression';
import supabase from './supabase';

const STORAGE_BUCKET = 'boat-images';
const MAX_SIZE_MB = 0.3; // 300 KB

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadBoatImage(file: File): Promise<string> {
  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
  });

  const path = `${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, compressed, { contentType: 'image/webp', upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteBoatImageFromStorage(
  imageUrl: string,
): Promise<void> {
  const url = new URL(imageUrl);
  const pathParts = url.pathname.split(`/${STORAGE_BUCKET}/`);
  if (pathParts.length < 2) return;
  const storagePath = pathParts[1];
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoatImage {
  id: string;
  boat_id: string;
  image_url: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Boat {
  id: string;
  name: string;
  slug: string;
  cover_image_id: string | null;
  description: string | null;
  location: string | null;
  pickup_location: string | null;
  max_guests: number | null;
  cabins: number | null;
  boat_type: string | null;
  price_per_hour: number | null;
  is_active: boolean;
  min_booking_hours: number | null;
  max_booking_hours: number | null;
  is_available_for_transport: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  images?: BoatImage[];
}

export interface CreateBoatInput {
  name: string;
  slug: string;
  description?: string;
  location?: string;
  pickup_location?: string;
  max_guests?: number;
  cabins?: number;
  boat_type?: string;
  price_per_hour?: number;
  is_active?: boolean;
  min_booking_hours?: number;
  max_booking_hours?: number;
  is_available_for_transport?: boolean;
}

export type UpdateBoatInput = Partial<CreateBoatInput> & {
  cover_image_id?: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBoats(): Promise<Boat[]> {
  const { data, error } = await supabase
    .from('boats')
    .select('*, images:boat_images!boat_id(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Boat[];
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createBoat(input: CreateBoatInput): Promise<Boat> {
  const { data, error } = await supabase
    .from('boats')
    .insert({
      ...input,
      is_active: input.is_active ?? true,
      is_available_for_transport: input.is_available_for_transport ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Boat;
}

export async function updateBoat({
  id,
  ...input
}: UpdateBoatInput & { id: string }): Promise<Boat> {
  const { data, error } = await supabase
    .from('boats')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Boat;
}

export async function deleteBoat(id: string): Promise<void> {
  const { error } = await supabase.from('boats').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Image mutations ───────────────────────────────────────────────────────────

export async function addBoatImage({
  boatId,
  file,
  position,
}: {
  boatId: string;
  file: File;
  position: number;
}): Promise<BoatImage> {
  const imageUrl = await uploadBoatImage(file);

  const { data, error } = await supabase
    .from('boat_images')
    .insert({ boat_id: boatId, image_url: imageUrl, position })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoatImage;
}

export async function deleteBoatImage({
  imageId,
  imageUrl,
}: {
  imageId: string;
  imageUrl: string;
}): Promise<void> {
  await deleteBoatImageFromStorage(imageUrl);
  const { error } = await supabase
    .from('boat_images')
    .delete()
    .eq('id', imageId);
  if (error) throw new Error(error.message);
}

export async function uploadAndSaveBoatImages(
  boatId: string,
  files: File[],
): Promise<BoatImage[]> {
  const results: BoatImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const row = await addBoatImage({ boatId, file: files[i], position: i });
    results.push(row);
  }
  return results;
}

export async function setBoatCoverImage({
  boatId,
  imageId,
}: {
  boatId: string;
  imageId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('boats')
    .update({ cover_image_id: imageId })
    .eq('id', boatId);
  if (error) throw new Error(error.message);
}

export async function updateBoatImagePositions(
  updates: { id: string; position: number }[],
): Promise<void> {
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('boat_images').update({ position }).eq('id', id),
    ),
  );
}
