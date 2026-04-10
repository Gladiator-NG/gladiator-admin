import { useRef, useState, useCallback } from 'react';
import { UploadCloud, X, Star } from 'lucide-react';
import styles from './styles/ImageUploader.module.css';

export interface UploadFile {
  /** stable local key, never changes */
  key: string;
  file: File;
  previewUrl: string;
  isCover: boolean;
}

interface ImageUploaderProps {
  files: UploadFile[];
  onChange: (files: UploadFile[]) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_RAW_MB = 20;

function ImageUploader({
  files,
  onChange,
  min = 4,
  max = 6,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── File processing ──────────────────────────────────
  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const arr = Array.from(incoming);

      const valid = arr.filter((f) => {
        if (!ACCEPTED.includes(f.type)) return false;
        if (f.size > MAX_RAW_MB * 1024 * 1024) return false;
        return true;
      });

      if (valid.length !== arr.length) {
        setError(
          `Only JPEG, PNG, WebP or HEIC images under ${MAX_RAW_MB} MB are accepted.`,
        );
      }

      const slots = max - files.length;
      if (slots <= 0) return;

      const toAdd = valid.slice(0, slots).map(
        (file, i): UploadFile => ({
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          isCover: files.length === 0 && i === 0,
        }),
      );

      onChange([...files, ...toAdd]);
    },
    [files, max, onChange],
  );

  // ── Drag handlers ────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    processFiles(e.dataTransfer.files);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      processFiles(e.target.files);
      // reset so same file can be re-added
      e.target.value = '';
    }
  }

  // ── Actions ──────────────────────────────────────────
  function removeFile(key: string) {
    const next = files.filter((f) => f.key !== key);
    // If we removed the cover, auto-assign first remaining as cover
    const hadCover = files.find((f) => f.key === key)?.isCover;
    if (hadCover && next.length > 0) {
      next[0] = { ...next[0], isCover: true };
    }
    onChange(next);
  }

  function setCover(key: string) {
    onChange(files.map((f) => ({ ...f, isCover: f.key === key })));
  }

  const canAddMore = files.length < max && !disabled;
  const isUnderMin = files.length < min;

  return (
    <div className={styles.root}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          Photos
          <span className={styles.labelMeta}>
            {' '}
            ({min}–{max} images required)
          </span>
        </span>
        <span
          className={`${styles.counter} ${isUnderMin ? styles.counterWarn : styles.counterOk}`}
        >
          {files.length} / {max}
        </span>
      </div>

      {/* Thumbnails + drop zone */}
      <div className={styles.grid}>
        {files.map((f) => (
          <div
            key={f.key}
            className={`${styles.thumb} ${f.isCover ? styles.thumbCover : ''}`}
          >
            <img src={f.previewUrl} alt="" className={styles.thumbImg} />

            <div className={styles.thumbOverlay}>
              {!f.isCover && (
                <button
                  type="button"
                  className={styles.thumbBtn}
                  title="Set as cover"
                  onClick={() => setCover(f.key)}
                  disabled={disabled}
                >
                  <Star size={13} />
                </button>
              )}
              {f.isCover && <span className={styles.coverLabel}>Cover</span>}
              <button
                type="button"
                className={`${styles.thumbBtn} ${styles.thumbBtnRemove}`}
                title="Remove"
                onClick={() => removeFile(f.key)}
                disabled={disabled}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}

        {canAddMore && (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            aria-label="Add photos"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <UploadCloud size={24} className={styles.dropIcon} />
            <span className={styles.dropText}>
              Drop or <span className={styles.dropLink}>browse</span>
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              className={styles.hiddenInput}
              onChange={onInputChange}
              disabled={disabled}
              tabIndex={-1}
            />
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isUnderMin && (
        <p className={styles.hint}>
          Add at least {min - files.length} more photo
          {min - files.length !== 1 ? 's' : ''} to continue. The starred image
          will be the cover photo.
        </p>
      )}
    </div>
  );
}

export default ImageUploader;
