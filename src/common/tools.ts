export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatRate(rateInBytesPerSecond: number): string {
  if (rateInBytesPerSecond === 0) return '0 B/s';

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let rate = rateInBytesPerSecond;
  let unitIndex = 0;

  while (rate >= 1024 && unitIndex < units.length - 1) {
    rate /= 1024;
    unitIndex++;
  }

  return `${rate.toFixed(2)} ${units[unitIndex]}`;
}
