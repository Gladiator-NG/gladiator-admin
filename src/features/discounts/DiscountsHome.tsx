import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Pencil, Plus, Search, Tag, TicketPercent, Users, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import supabase from '../../services/supabase';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import styles from './DiscountsHome.module.css';

type Discount = {
  id: string; code: string; partner_name: string; discount_type: 'percentage' | 'fixed';
  value: number; is_active: boolean; starts_at: string | null; expires_at: string | null;
  max_uses: number | null; max_uses_per_customer: number | null; minimum_subtotal: number;
  booking_type: string | null;
};
type Usage = { discount_code_id: string; reserved: number; redeemed: number };
type Filter = 'all' | 'active' | 'inactive';

const blank = { code: '', partner_name: '', discount_type: 'percentage', value: '', is_active: true,
  starts_at: '', expires_at: '', max_uses: '', max_uses_per_customer: '', minimum_subtotal: '0', booking_type: '' };
const localDate = (value: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  : '';

function statusFor(discount: Discount, usage?: Usage) {
  if (!discount.is_active) return { key: 'inactive', label: 'Inactive' };
  if (discount.expires_at && new Date(discount.expires_at) <= new Date()) return { key: 'expired', label: 'Expired' };
  if (discount.starts_at && new Date(discount.starts_at) > new Date()) return { key: 'scheduled', label: 'Scheduled' };
  if (discount.max_uses && Number(usage?.reserved || 0) >= discount.max_uses) return { key: 'limit', label: 'Limit reached' };
  return { key: 'active', label: 'Active' };
}

function formatOffer(discount: Discount) {
  return discount.discount_type === 'percentage'
    ? `${discount.value}% off`
    : `₦${Number(discount.value).toLocaleString()} off`;
}

function formatExperience(value: string | null) {
  const labels: Record<string, string> = { boat_cruise: 'Boat cruises', boat_rental: 'Boat transfers', beach_house: 'Beach houses' };
  return value ? labels[value] : 'All experiences';
}

function formatValidity(discount: Discount) {
  if (!discount.starts_at && !discount.expires_at) return 'No expiry';
  const date = (value: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  if (discount.starts_at && discount.expires_at) return `${date(discount.starts_at)} – ${date(discount.expires_at)}`;
  if (discount.expires_at) return `Ends ${date(discount.expires_at)}`;
  return `Starts ${date(discount.starts_at!)}`;
}

export default function DiscountsHome() {
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, isLoading } = useQuery({
    queryKey: ['discount-codes'],
    queryFn: async () => {
      const [codes, usage] = await Promise.all([
        supabase.from('discount_codes').select('*').order('created_at', { ascending: false }),
        supabase.rpc('discount_code_usage'),
      ]);
      if (codes.error || usage.error) throw new Error(codes.error?.message || usage.error?.message);
      return { codes: codes.data as Discount[], usage: usage.data as Usage[] };
    },
  });

  const usageByCode = useMemo(() => new Map(data?.usage.map((usage) => [usage.discount_code_id, usage])), [data?.usage]);
  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.codes ?? []).filter((discount) => {
      const status = statusFor(discount, usageByCode.get(discount.id));
      const matchesSearch = !query || `${discount.code} ${discount.partner_name} ${formatExperience(discount.booking_type)}`.toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || (filter === 'active'
        ? status.key === 'active' || status.key === 'scheduled'
        : status.key !== 'active' && status.key !== 'scheduled');
      return matchesSearch && matchesFilter;
    });
  }, [data?.codes, filter, search, usageByCode]);

  const stats = useMemo(() => {
    const codes = data?.codes ?? [];
    const active = codes.filter((discount) => ['active', 'scheduled'].includes(statusFor(discount, usageByCode.get(discount.id)).key)).length;
    const redeemed = (data?.usage ?? []).reduce((sum, usage) => sum + Number(usage.redeemed), 0);
    const partners = new Set(codes.map((discount) => discount.partner_name.trim()).filter(Boolean)).size;
    return { active, redeemed, partners };
  }, [data, usageByCode]);

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setIsModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen, saving]);

  const field = (name: keyof typeof blank, value: string | boolean) => setForm((current) => ({ ...current, [name]: value }));
  function openCreate() { setEditing(null); setForm(blank); setIsModalOpen(true); }
  function edit(discount: Discount) {
    setEditing(discount.id);
    setForm({ ...discount, value: String(discount.value), starts_at: localDate(discount.starts_at), expires_at: localDate(discount.expires_at),
      max_uses: discount.max_uses?.toString() || '', max_uses_per_customer: discount.max_uses_per_customer?.toString() || '',
      minimum_subtotal: String(discount.minimum_subtotal), booking_type: discount.booking_type || '' });
    setIsModalOpen(true);
  }
  function closeModal() { if (!saving) { setIsModalOpen(false); setEditing(null); setForm(blank); } }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { code: form.code.trim().toUpperCase(), partner_name: form.partner_name.trim(), discount_type: form.discount_type,
        value: Number(form.value), is_active: form.is_active, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null, max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_uses_per_customer: form.max_uses_per_customer ? Number(form.max_uses_per_customer) : null,
        minimum_subtotal: Number(form.minimum_subtotal), booking_type: form.booking_type || null };
      if (payload.starts_at && payload.expires_at && payload.expires_at <= payload.starts_at) throw new Error('Expiry must be after the start date.');
      const result = editing
        ? await supabase.from('discount_codes').update(payload).eq('id', editing)
        : await supabase.from('discount_codes').insert(payload);
      if (result.error) throw new Error(result.error.code === '23505' ? 'That code already exists.' : result.error.message);
      const message = editing ? 'Discount updated' : 'Discount created';
      setIsModalOpen(false); setEditing(null); setForm(blank);
      await client.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success(message);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save discount');
    } finally { setSaving(false); }
  }

  async function toggle(discount: Discount) {
    setSaving(true);
    const result = await supabase.from('discount_codes').update({ is_active: !discount.is_active }).eq('id', discount.id);
    if (result.error) toast.error(result.error.message);
    else { await client.invalidateQueries({ queryKey: ['discount-codes'] }); toast.success(discount.is_active ? 'Code deactivated' : 'Code activated'); }
    setSaving(false);
  }
  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast.success(`${code} copied`); }
    catch { toast.error('Could not copy code'); }
  }

  return <section className={styles.page}>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>Sales tools</p><h1>Discount codes</h1><p className={styles.subtitle}>Manage offers shared with partners, agents and customers.</p></div>
      <button className={styles.primaryButton} onClick={openCreate}><Plus size={18} />Create discount</button>
    </header>

    <div className={styles.statsGrid}>
      <article className={styles.statCard}><span className={styles.statIcon}><TicketPercent size={20} /></span><div><strong>{stats.active}</strong><span>Active codes</span></div></article>
      <article className={styles.statCard}><span className={styles.statIcon}><Check size={20} /></span><div><strong>{stats.redeemed}</strong><span>Total redemptions</span></div></article>
      <article className={styles.statCard}><span className={styles.statIcon}><Users size={20} /></span><div><strong>{stats.partners}</strong><span>Partners & agents</span></div></article>
    </div>

    <div className={styles.managementCard}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}><Search size={18} /><input aria-label="Search discount codes" placeholder="Search by code, partner or experience" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className={styles.filters} aria-label="Filter discount codes">
          {(['all', 'active', 'inactive'] as Filter[]).map((item) => <button className={filter === item ? styles.filterActive : ''} key={item} onClick={() => setFilter(item)}>{item === 'all' ? 'All codes' : item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </div>
      {isLoading && <div className={styles.message}>Loading discount codes…</div>}
      {error && <div className={styles.error} role="alert">{error.message}</div>}
      {!isLoading && !error && filteredCodes.length > 0 && <div className={styles.tableWrap}><table>
        <thead><tr><th>Code</th><th>Offer</th><th>Valid for</th><th>Usage</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
        <tbody>{filteredCodes.map((discount) => {
          const usage = usageByCode.get(discount.id); const status = statusFor(discount, usage); const used = Number(usage?.reserved || 0);
          const progress = discount.max_uses ? Math.min((used / discount.max_uses) * 100, 100) : 0;
          return <tr key={discount.id}>
            <td data-label="Code"><div className={styles.codeCell}><button className={styles.codeButton} onClick={() => copyCode(discount.code)} title="Copy code"><Tag size={15} />{discount.code}<Copy size={14} /></button><span>{discount.partner_name || 'Direct offer'}</span></div></td>
            <td data-label="Offer"><strong className={styles.offer}>{formatOffer(discount)}</strong>{discount.minimum_subtotal > 0 && <span className={styles.secondaryText}>Min. ₦{Number(discount.minimum_subtotal).toLocaleString()}</span>}</td>
            <td data-label="Valid for"><span>{formatExperience(discount.booking_type)}</span><span className={styles.secondaryText}>{formatValidity(discount)}</span></td>
            <td data-label="Usage"><div className={styles.usageText}><span><strong>{used}</strong>{discount.max_uses ? ` of ${discount.max_uses}` : ' reserved'}</span><small>{Number(usage?.redeemed || 0)} redeemed</small></div>{discount.max_uses && <div className={styles.progressTrack} aria-label={`${Math.round(progress)}% of usage limit reserved`}><span style={{ width: `${progress}%` }} /></div>}</td>
            <td data-label="Status"><span className={`${styles.status} ${styles[`status_${status.key}`]}`}><i />{status.label}</span></td>
            <td className={styles.rowActions}><button title="Edit discount" onClick={() => edit(discount)}><Pencil size={17} /><span>Edit</span></button><button className={discount.is_active ? styles.deactivateButton : styles.activateButton} disabled={saving} onClick={() => toggle(discount)}>{discount.is_active ? 'Deactivate' : 'Activate'}</button></td>
          </tr>;
        })}</tbody>
      </table></div>}
      {!isLoading && !error && filteredCodes.length === 0 && <div className={styles.emptyState}>
        <span><TicketPercent size={24} /></span><h2>{data?.codes.length ? 'No matching codes' : 'Create your first discount code'}</h2>
        <p>{data?.codes.length ? 'Try a different search or status filter.' : 'Set up an offer for a partner, agent or customer campaign.'}</p>
        {!data?.codes.length && <button className={styles.primaryButton} onClick={openCreate}><Plus size={18} />Create discount</button>}
      </div>}
    </div>

    <AnimatePresence>{isModalOpen && <motion.div className={styles.backdrop} {...backdropAnim} onClick={(event) => event.target === event.currentTarget && closeModal()}>
      <motion.div aria-labelledby="discount-modal-title" aria-modal="true" className={styles.modal} role="dialog" {...modalAnim}>
        <div className={styles.modalHeader}><div><p className={styles.eyebrow}>{editing ? 'Update offer' : 'New offer'}</p><h2 id="discount-modal-title">{editing ? 'Edit discount code' : 'Create discount code'}</h2><p>Configure who can use the offer and when it is available.</p></div><button type="button" className={styles.closeButton} onClick={closeModal} aria-label="Close modal"><X size={20} /></button></div>
        <form onSubmit={save}>
          <div className={styles.modalContent}>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}><span>1</span><div><h3>Offer details</h3><p>The code customers enter at checkout.</p></div></div>
              <div className={styles.formGrid}>
                <label>Discount code<input autoFocus required pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} value={form.code} onChange={(event) => field('code', event.target.value.toUpperCase())} placeholder="PARTNER10" /></label>
                <label>Partner or agent <span className={styles.optional}>Optional</span><input value={form.partner_name} onChange={(event) => field('partner_name', event.target.value)} placeholder="Who is this code for?" /></label>
                <label>Discount type<select value={form.discount_type} onChange={(event) => field('discount_type', event.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (NGN)</option></select></label>
                <label>{form.discount_type === 'percentage' ? 'Percentage off' : 'Amount off (NGN)'}<div className={styles.inputSuffix}><input required type="number" min="0.01" max={form.discount_type === 'percentage' ? '99.99' : undefined} step="0.01" value={form.value} onChange={(event) => field('value', event.target.value)} placeholder="10" /><span>{form.discount_type === 'percentage' ? '%' : 'NGN'}</span></div></label>
              </div>
            </section>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}><span>2</span><div><h3>Rules & availability</h3><p>Leave limits blank to allow unrestricted use.</p></div></div>
              <div className={styles.formGrid}>
                <label>Experience<select value={form.booking_type} onChange={(event) => field('booking_type', event.target.value)}><option value="">All experiences</option><option value="boat_cruise">Boat cruises</option><option value="boat_rental">Boat transfers</option><option value="beach_house">Beach houses</option></select></label>
                <label>Minimum booking subtotal<input required type="number" min="0" step="0.01" value={form.minimum_subtotal} onChange={(event) => field('minimum_subtotal', event.target.value)} /></label>
                <label>Valid from <span className={styles.optional}>Optional</span><input type="datetime-local" value={form.starts_at} onChange={(event) => field('starts_at', event.target.value)} /></label>
                <label>Expires <span className={styles.optional}>Optional</span><input type="datetime-local" value={form.expires_at} onChange={(event) => field('expires_at', event.target.value)} /></label>
                <label>Total usage limit <span className={styles.optional}>Optional</span><input type="number" min="1" step="1" placeholder="Unlimited" value={form.max_uses} onChange={(event) => field('max_uses', event.target.value)} /></label>
                <label>Uses per customer <span className={styles.optional}>Optional</span><input type="number" min="1" step="1" placeholder="Unlimited" value={form.max_uses_per_customer} onChange={(event) => field('max_uses_per_customer', event.target.value)} /></label>
              </div>
              <label className={styles.activeToggle}><span><strong>Active</strong><small>Customers can apply this code at checkout.</small></span><input type="checkbox" checked={form.is_active} onChange={(event) => field('is_active', event.target.checked)} /><i /></label>
            </section>
          </div>
          <div className={styles.modalFooter}><p>Discounts are applied before VAT.</p><div><button type="button" className={styles.secondaryButton} onClick={closeModal}>Cancel</button><button className={styles.primaryButton} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create discount'}</button></div></div>
        </form>
      </motion.div>
    </motion.div>}</AnimatePresence>
  </section>;
}
