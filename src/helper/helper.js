import { parse } from 'date-fns';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

export function getAccessExtension(currentExpirationDate, extensionType, extensionLength) {
  let expiration = parse(currentExpirationDate, "yyyy-MM-dd HH:mm:ssX", new Date());

  switch (extensionType.toUpperCase()) {
    case 'Y':
      expiration = addYears(expiration, extensionLength);
      break;
    case 'M':
      expiration = addMonths(expiration, extensionLength);
      break;
    case 'W':
      expiration = addWeeks(expiration, extensionLength);
      break;
    case 'D':
      expiration = addDays(expiration, extensionLength);
      break;
    default:
      throw new Error("Invalid extension type");
  }

  // TradingView format: "2025-12-31 23:59:59+00"
  return expiration.toISOString().replace("T", " ").substring(0, 19) + "+00";
}