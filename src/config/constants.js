export const API_URLS = {
  tvcoins: "https://www.tradingview.com/tvcoins/details/",
  username_hint: "https://www.tradingview.com/username_hint/",
  list_users: "https://www.tradingview.com/pine_perm/list_users/",
  modify_access: "https://www.tradingview.com/pine_perm/modify_user_expiration/",
  add_access: "https://www.tradingview.com/pine_perm/add/",
  remove_access: "https://www.tradingview.com/pine_perm/remove/",
  signin: "https://www.tradingview.com/accounts/signin/",
  signin_totp: "https://www.tradingview.com/accounts/two-factor/signin/totp/"
};

export const DEFAULTS = {
  SESSION_TTL: 12 * 60 * 60 * 1000,
  LOG_FILE: './access-logs.json',
  SESSION_FILE: './session.json',
  HEADER_TIMEOUT: 30000
};

export const PINE_NAMES = {
  "PUB;fad4694201c0492caa1ea2815c92fa40": "Fractal Model Lite",
  "PUB;6e687c53f1df41d4897f1a944a074ffd": "SD Range Lite",
  "PUB;af8ad7682e624bcdb15d758d3e2d06f7": "PD RTH"
};
