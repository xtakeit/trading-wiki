export interface MetricCardProps {
  label: string;
  value: string | number;
  hint: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="glass-card stat-card">
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
      <span className="text-muted">{hint}</span>
    </div>
  );
}
