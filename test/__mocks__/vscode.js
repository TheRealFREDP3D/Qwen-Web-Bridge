module.exports = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key, def) => def),
      update: jest.fn(),
    })),
    fs: {
      writeFile: jest.fn(),
      readFile: jest.fn(() => Buffer.from("[]")),
      delete: jest.fn(),
    },
  },
  window: {
    showInformationMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({ appendLine: jest.fn() })),
  },
  ConfigurationTarget: {
    Global: 1,
  },
  LogLevel: {
    Trace: 0,
    Debug: 1,
    Info: 2,
    Warning: 3,
    Error: 4,
    Critical: 5,
    Off: 6,
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
    joinPath: jest.fn((base, ...paths) => ({
      fsPath: [base, ...paths].join("/"),
    })),
  },
};
