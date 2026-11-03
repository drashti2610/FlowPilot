/**
 * Format ISO datetime string to readable date/time.
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

/**
 * Format ISO datetime string into relative time (e.g., '5 mins ago', '2 days ago').
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Never';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 30) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    return formatDate(isoString);
  } catch {
    return 'Never';
  }
}

/**
 * Get status badge classes and label.
 */
export function getStatusBadge(status: string | null | undefined): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
} {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
      return {
        label: 'Success',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
      };
    case 'FAILED':
      return {
        label: 'Failed',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        dotClass: 'bg-rose-500',
      };
    case 'RUNNING':
      return {
        label: 'Running',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    default:
      return {
        label: 'Never Run',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-200',
        dotClass: 'bg-slate-400',
      };
  }
}

/**
 * Get action type badge info.
 */
export function getActionTypeBadge(type: string): {
  label: string;
  color: string;
  badgeBg: string;
} {
  switch (type) {
    case 'TRANSFORM_TEXT':
      return {
        label: 'Transform Text',
        color: 'text-indigo-700',
        badgeBg: 'bg-indigo-50 border-indigo-200',
      };
    case 'CALCULATE_METRIC':
      return {
        label: 'Calculate Metric',
        color: 'text-cyan-700',
        badgeBg: 'bg-cyan-50 border-cyan-200',
      };
    case 'LOG_MESSAGE':
      return {
        label: 'Log Message',
        color: 'text-amber-700',
        badgeBg: 'bg-amber-50 border-amber-200',
      };
    default:
      return {
        label: type,
        color: 'text-slate-700',
        badgeBg: 'bg-slate-50 border-slate-200',
      };
  }
}

