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
  },
  ConfigurationTarget: {
    Global: 1,
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
    joinPath: jest.fn((base, ...paths) => ({
      fsPath: [base, ...paths].join("/"),
    })),
  },
};
