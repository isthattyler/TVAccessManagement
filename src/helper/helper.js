import { parse, format } from 'date-fns';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

const TV_FORMAT = 'yyyy-MM-dd HH:mm:ssX';
const OUTPUT_FORMAT = "yyyy-MM-dd HH:mm:ss";

export function getAccessExtension(currentExpirationDate, extensionType, extensionLength) {
  let expiration = parse(currentExpirationDate, TV_FORMAT, new Date());
  if (isNaN(expiration.getTime())) {
    expiration = new Date(currentExpirationDate);
  }
  const type = extensionType.toUpperCase();

  switch (type) {
    case 'D':
    case 'W':
    case 'M':
    case 'Y':
      expiration = extensionLength === 0 ? expiration :
        type === 'D' ? addDays(expiration, extensionLength) :
        type === 'W' ? addWeeks(expiration, extensionLength) :
        type === 'M' ? addMonths(expiration, extensionLength) :
        addYears(expiration, extensionLength);
      break;
    case 'L':
      expiration = new Date('2099-12-31 23:59:59+00');
      break;
    default:
      throw new Error(`Invalid extension type: ${extensionType}`);
  }

  return format(expiration, OUTPUT_FORMAT);
}

export function parseDuration(duration) {
  if (duration?.toUpperCase() === 'L') return { value: 0, type: 'L' };
  if (/^(\d+)([YMDWL])$/.test(duration)) {
    const match = duration.match(/(\d+)([YMDWL])/);
    return { value: parseInt(match[1], 10), type: match[2] };
  }
  throw new Error('Invalid duration format. Expected format: 30D, 6M, 1Y, 1W, 1L');
}
