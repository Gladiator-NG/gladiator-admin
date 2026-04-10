import { useRef, useState, useCallback } from 'react';
import { GripVertical, Star, X, UploadCloud } from 'lucide-react';
import styles from './styles/EditImageGrid.module.css';

export type EditableImage =
  | { kind: 'existing'; id: string; image_url: string; isCover: boolean }
  | {
      kind: 'new';
      key: string;
      file: File;
      previewUrl: string;
      isCover: boolean;
    };

export function getEditableKey(img: EditableImage): string {
  return img.kind === 'existing' ? img.id : img.key;
}

function getPreview(img: EditableImage): string {
  return img.kind === 'existing' ? img.image_url : img.previewUrl;
}

interface EditImageGridProps {
  images: EditableImage[];
  onChange: (images: EditableImage[]) => void;
  max?: number;
  disabled?: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_RAW_MB = 20;

export default function EditImageGrid({
  images,
  onChange,
  max = 6,
  disabled = false,
}: EditImageGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef(-1);
  const [dragOverIndex, setDragOverIndex] = useState(-1);
  const [isNewFileDrop, setIsNewFileDrop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Reorder drag ─────────────────────────────────────
  function onItemDragStart(i: number, e: React.DragEvent) {
    dragIndexRef.current = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  }

  function onItemDragOver(i: number, e: React.DragEvent) {
    if (dragIndexRef.current < 0) return; // external file — ignore
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(i);
  }

  function onItemDrop(i: number, e: React.DragEvent) {
    if (dragIndexRef.current < 0) return;
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = -1;
    setDragOverIndex(-1);
    if (from === i) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onChange(next);
  }

  function onItemDragEnd() {
    dragIndexRef.current = -1;
    setDragOverIndex(-1);
  }

  // ── Cover / remove ───────────────────────────────────
  function setCover(key: string) {
    onChange(
      images.map((img) => ({ ...img, isCover: getEditableKey(img) === key })),
    );
  }

  function removeImage(key: string) {
    const hadCover =
      images.find((img) => getEditableKey(img) === key)?.isCover ?? false;
    const next = images.filter((img) => getEditableKey(img) !== key);
    if (hadCover && next.length > 0) next[0] = { ...next[0], isCover: true };
    onChange(next);
  }

  // ── New file add ─────────────────────────────────────
  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const arr = Array.from(incoming);
      const valid = arr.filter(
        (f) => ACCEPTED.includes(f.type) && f.size <= MAX_RAW_MB * 1024 * 1024,
      );
      if (valid.length !== arr.length) {
        setError(
          `Only JPEG, PNG, WebP or HEIC images under ${MAX_RAW_MB} MB accepted.`,
        );
      }
      const slots = max - images.length;
      if (slots <= 0) return;
      const toAdd: EditableImage[] = valid.slice(0, slots).map((file) => ({
        kind: 'new',
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        isCover: false,
      }));
      onChange([...images, ...toAdd]);
    },
    [images, max, onChange],
  );

  function onNewFileDragOver(e: React.DragEvent) {
    if (dragIndexRef.current >= 0) return; // tile reorder drag — ignore
    e.preventDefault();
    if (!disabled) setIsNewFileDrop(true);
  }

  function onNewFileDragLeave() {
    setIsNewFileDrop(false);
  }

  function onNewFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsNewFileDrop(false);
    if (disabled || dragIndexRef.current >= 0) return;
    processFiles(e.dataTransfer.files);
  }

  const canAdd = images.length < max && !disabled;

  return (
    <div className={styles.root}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          Photos{' '}
          <span className={styles.labelMeta}>
            — drag to reorder · ★ to set cover
          </span>
        </span>
        <span
          className={`${styles.counter} ${images.length < 4 ? styles.counterWarn : styles.counterOk}`}
        >
          {images.length} / {max}
        </span>
      </div>

      <div className={styles.grid}>
        {images.map((img, i) => {
          const key = getEditableKey(img);
          const preview = getPreview(img);
          return (
            <div
              key={key}
              className={`${styles.thumb} ${img.isCover ? styles.thumbCover : ''} ${dragOverIndex === i ? styles.thumbDragOver : ''}`}
              draggable={!disabled}
              onDragStart={(e) => onItemDragStart(i, e)}
              onDragOver={(e) => onItemDragOver(i, e)}
              onDrop={(e) => onItemDrop(i, e)}
              onDragEnd={onItemDragEnd}
            >
              <img
                src={preview}
                alt=""
                className={styles.thumbImg}
                draggable={false}
              />
              {img.kind === 'new' && (
                <span className={styles.newBadge}>New</span>
              )}
              <div className={styles.thumbOverlay}>
                <div className={styles.thumbTop}>
                  <span className={styles.gripHandle}>
                    <GripVertical size={14} />
                  </span>
                  {img.isCover && (
                    <span className={styles.coverLabel}>Cover</span>
                  )}
                </div>
                <div className={styles.thumbBottom}>
                  {!img.isCover && (
                    <button
                      type="button"
                      className={styles.thumbBtn}
                      title="Set as cover"
                      onClick={() => setCover(key)}
                      disabled={disabled}
                    >
                      <Star size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.thumbBtn} ${styles.thumbBtnRemove}`}
                    title="Remove"
                    onClick={() => removeImage(key)}
                    disabled={disabled}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {canAdd && (
          <div
            className={`${styles.dropZone} ${isNewFileDrop ? styles.dropZoneDragging : ''}`}
            onDragOver={onNewFileDragOver}
            onDragLeave={onNewFileDragLeave}
            onDrop={onNewFileDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Add photos"
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <UploadCloud size={22} className={styles.dropIcon} />
            <span className={styles.dropText}>
              Drop or <span className={styles.dropLink}>browse</span>
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              className={styles.hiddenInput}
              onChange={(e) => {
                if (e.target.files?.length) {
                  processFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              disabled={disabled}
              tabIndex={-1}
            />
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
