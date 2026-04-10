import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Anchor, Home, Users, BookOpen } from 'lucide-react';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import type { SearchResult } from '../services/apiSearch';
import styles from './styles/GlobalSearch.module.css';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ResultIcon({ kind }: { kind: SearchResult['kind'] }) {
  if (kind === 'booking') return <BookOpen size={14} />;
  if (kind === 'boat') return <Anchor size={14} />;
  if (kind === 'beach_house') return <Home size={14} />;
  return <Users size={14} />;
}

const SECTION_LABELS: Record<SearchResult['kind'], string> = {
  booking: 'Bookings',
  boat: 'Boats',
  beach_house: 'Beach Houses',
  user: 'Users',
};

function resultLabel(r: SearchResult): string {
  if (r.kind === 'booking') return r.reference_code;
  if (r.kind === 'boat') return r.name;
  if (r.kind === 'beach_house') return r.name;
  return r.full_name ?? 'Unknown user';
}

function resultSub(r: SearchResult): string {
  if (r.kind === 'booking') return r.customer_name;
  if (r.kind === 'boat') return r.boat_type ?? (r.is_active ? 'Active' : 'Inactive');
  if (r.kind === 'beach_house') return r.location ?? (r.is_active ? 'Active' : 'Inactive');
  return r.role ?? 'No role';
}

function resultPath(r: SearchResult): string {
  if (r.kind === 'booking') return `/bookings?open=${r.id}`;
  if (r.kind === 'boat') return `/boats?highlight=${r.id}`;
  if (r.kind === 'beach_house') return `/beach-houses?highlight=${r.id}`;
  return `/users?highlight=${r.id}`;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const debouncedQuery = useDebounce(query, 250);
  const { data, isFetching } = useGlobalSearch(debouncedQuery);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build flat list for keyboard nav
  const flatResults: SearchResult[] = data
    ? [
        ...data.bookings,
        ...data.boats,
        ...data.beachHouses,
        ...data.users,
      ]
    : [];

  const hasResults = flatResults.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Reset cursor when results change
  useEffect(() => {
    setCursor(-1);
  }, [debouncedQuery]);

  const commit = useCallback(
    (r: SearchResult) => {
      navigate(resultPath(r));
      setOpen(false);
      setQuery('');
    },
    [navigate],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0 && flatResults[cursor]) {
      commit(flatResults[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // Group results back by section for display
  type Section = { kind: SearchResult['kind']; items: SearchResult[] };
  const sections: Section[] = [];
  if (data?.bookings.length) sections.push({ kind: 'booking', items: data.bookings });
  if (data?.boats.length) sections.push({ kind: 'boat', items: data.boats });
  if (data?.beachHouses.length) sections.push({ kind: 'beach_house', items: data.beachHouses });
  if (data?.users.length) sections.push({ kind: 'user', items: data.users });

  let flatIndex = -1; // running index for cursor tracking

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div
        className={`${styles.searchBar} ${open ? styles.searchBarFocused : ''}`}
      >
        {isFetching && query.trim().length >= 2 ? (
          <Loader2 size={16} className={styles.spinnerIcon} />
        ) : (
          <Search size={16} className={styles.searchIcon} />
        )}
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder="Search booking ID, boat, name…"
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Global search"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
      </div>

      {showDropdown && (
        <div className={styles.dropdown} role="listbox">
          {!hasResults && !isFetching && (
            <p className={styles.empty}>No results for "{query}"</p>
          )}

          {sections.map((section) => (
            <div key={section.kind} className={styles.section}>
              <p className={styles.sectionLabel}>
                {SECTION_LABELS[section.kind]}
              </p>
              {section.items.map((r) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <button
                    key={r.id}
                    role="option"
                    aria-selected={cursor === idx}
                    className={`${styles.resultItem} ${cursor === idx ? styles.resultItemActive : ''}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => commit(r)}
                  >
                    <span className={`${styles.resultIcon} ${styles[`icon_${r.kind}`]}`}>
                      <ResultIcon kind={r.kind} />
                    </span>
                    <span className={styles.resultText}>
                      <span className={styles.resultLabel}>{resultLabel(r)}</span>
                      <span className={styles.resultSub}>{resultSub(r)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
