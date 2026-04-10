import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  addBeachHouseImage,
  deleteBeachHouseImage,
  setCoverImage,
} from '../../services/apiBeachHouse';

export function useAddBeachHouseImage() {
  const queryClient = useQueryClient();

  const { mutate: addImage, isPending } = useMutation({
    mutationFn: addBeachHouseImage,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return { addImage, isPending };
}

export function useDeleteBeachHouseImage() {
  const queryClient = useQueryClient();

  const { mutate: removeImage, isPending } = useMutation({
    mutationFn: deleteBeachHouseImage,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return { removeImage, isPending };
}

export function useSetCoverImage() {
  const queryClient = useQueryClient();

  const { mutate: setCover, isPending } = useMutation({
    mutationFn: setCoverImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beach_houses'] });
      toast.success('Cover image updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { setCover, isPending };
}
