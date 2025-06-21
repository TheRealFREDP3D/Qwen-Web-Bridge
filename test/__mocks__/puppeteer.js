const mockPage = {
  goto: jest.fn(() => Promise.resolve()),
  setCookie: jest.fn((...cookies) => Promise.resolve()),
  cookies: jest.fn(() => Promise.resolve([])),
  evaluate: jest.fn(() => Promise.resolve("")),
  waitForSelector: jest.fn(() => Promise.resolve()),
  $: jest.fn(() => Promise.resolve(null)),
  $$: jest.fn(() => Promise.resolve([])),
  type: jest.fn(() => Promise.resolve()),
  click: jest.fn(() => Promise.resolve()),
  keyboard: {
    press: jest.fn(() => Promise.resolve()),
  },
  target: jest.fn(() => ({
    createCDPSession: jest.fn(() => ({
      send: jest.fn(() => Promise.resolve()),
    })),
  })),
  screenshot: jest.fn(() => Promise.resolve()),
  bringToFront: jest.fn(() => Promise.resolve()),
};

const mockBrowser = {
  pages: jest.fn(() => Promise.resolve([mockPage])),
  newPage: jest.fn(() => Promise.resolve(mockPage)),
  close: jest.fn(() => Promise.resolve()),
};

module.exports = {
  launch: jest.fn(() => Promise.resolve(mockBrowser)),
};
