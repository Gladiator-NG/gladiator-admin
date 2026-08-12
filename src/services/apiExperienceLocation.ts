import supabase from './supabase';

export interface ExperienceLocation {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getAllExperienceLocations(): Promise<ExperienceLocation[]> {
  const { data, error } = await supabase
    .from('experience_locations')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExperienceLocation[];
}

export async function createExperienceLocation(input: {
  name: string;
  description?: string;
  sort_order?: number;
}): Promise<ExperienceLocation> {
  const { data, error } = await supabase
    .from('experience_locations')
    .insert({ ...input, is_active: true })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ExperienceLocation;
}

export async function updateExperienceLocation(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    sort_order: number;
  }>,
): Promise<ExperienceLocation> {
  const { data, error } = await supabase
    .from('experience_locations')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ExperienceLocation;
}

export async function reorderExperienceLocations(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from('experience_locations')
        .update({ sort_order: index + 1 })
        .eq('id', id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteExperienceLocation(id: string): Promise<void> {
  const { error } = await supabase
    .from('experience_locations')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

