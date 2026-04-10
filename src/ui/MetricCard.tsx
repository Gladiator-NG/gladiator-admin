import { useCountUp } from '../hooks/useCountUp';
import styles from './MetricCard.module.css';

export interface MetricCardProps {
  label: string;
  value: number;
  renderValue?: (v: number) => string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
  iconBg?: string;
  featured?: boolean;
}

export function MetricCard({
  label,
  value,
  renderValue,
  sub,
  icon,
  accent,
  iconBg,
  featured = false,
}: MetricCardProps) {
  const animated = useCountUp(value);
  const display = renderValue ? renderValue(animated) : String(animated);

  return (
    <div
      className={`${styles.metricCard} ${featured ? styles.metricCardFeatured : ''}`}
      style={
        {
          '--metric-accent': accent,
          '--metric-icon-bg': iconBg,
        } as React.CSSProperties
      }
    >
      <div className={styles.metricTop}>
        <div className={styles.metricIcon}>{icon}</div>
        <p className={styles.metricLabel}>{label}</p>
      </div>
      <p className={styles.metricValue}>{display}</p>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}
