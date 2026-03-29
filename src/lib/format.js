export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function formatCurrencyLakh(value) {
  return `INR ${value.toFixed(2)}L`;
}

export function formatDate() {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}
