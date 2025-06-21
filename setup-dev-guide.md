# Qwen Proxy VSCode Extension - Setup Guide

## Quick Start

### Phase 1: Basic Setup (Current Goal)

1. **Create Project Directory**

   ```bash
   mkdir qwen-proxy
   cd qwen-proxy
   ```

2. **Initialize Node.js Project**

   ```bash
   npm init -y
   # Copy the package.json content from the artifact
   ```

3. **Install Dependencies**

   ```bash
   npm install express puppeteer dotenv cors
   npm install -D @types/vscode @types/node @types/express typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint @vscode/test-cli @vscode/test-electron
   ```

4. **Create Project Structure**

   ```bash
   mkdir -p src test docs .vscode
   # Copy all TypeScript files from artifacts to src/
   # Copy configuration files to root
   ```

5. **Compile TypeScript**

   ```bash
   npm run compile
   ```

6. **Test in VSCode**
   - Open project in VSCode
   - Press F5 to launch Extension Development Host
   - Open Command Palette (Ctrl+Shift+P)
   - Run "Start Qwen Proxy Server"

## Development Workflow

### Current Phase: Foundation (Week 1)

- ✅ Project structure setup
- ✅ Basic extension framework
- ✅ Express server foundation
- ✅ **Test basic server startup**

### Phase 2: Web Automation (Week 2)

- ⏳ **Next: Test Puppeteer connection to Qwen**
- Implement basic message sending
- Handle authentication requirements
- Debug web selectors

### Phase 3: API Integration (Week 3)

- Implement OpenAI-compatible endpoints
- Add streaming support
- Test with coding assistants
- Error handling improvements

### Phase 4: Polish (Week 4)

- Performance optimization
- Documentation
- Configuration options
- Testing and validation

## Testing Strategy

### Automated Testing

Automated endpoint tests are provided using **Jest** and **Supertest**. These tests cover:
- `/health` endpoint (server health)
- `/v1/models` endpoint (model list)
- `/status` endpoint (server status)
- `/v1/chat/completions` endpoint (invalid request handling)

**To run all automated tests:**

```bash
npm test
```

Test files are located in the `test/` directory, with one file per endpoint for clarity and maintainability.

### Manual Testing

1. **Extension Activation**

   ```bash
   # In VSCode Extension Development Host
   # Check status bar shows "Qwen Proxy"
   # Run: Qwen Proxy: Check Status
   ```

2. **Server Functionality**

   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/v1/models
   ```

3. **Basic Chat Test**

   ```bash
   curl -X POST http://localhost:3001/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "qwen-turbo",
       "messages": [{"role": "user", "content": "Hello"}]
     }'
   ```

### Integration Testing

- Test with Continue.dev
- Test with other OpenAI-compatible tools
- Verify streaming responses

## Troubleshooting

### Common Issues

1. **Extension Not Activating**
   - Check TypeScript compilation errors
   - Verify package.json activation events
   - Check VSCode Developer Tools console

2. **Server Won't Start**
   - Port already in use (try different port)
   - Missing dependencies
   - Configuration issues

3. **Puppeteer Issues**
   - Chrome/Chromium not found
   - Sandbox restrictions
   - Network connectivity

4. **Qwen Connection Issues**
   - Website structure changed
   - Authentication required
   - Rate limiting

### Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run compile
```

## Configuration Options

### VSCode Settings

- `qwen-proxy.port`: Server port (default: 3001)
- `qwen-proxy.qwenUrl`: Qwen website URL
- `qwen-proxy.autoStart`: Auto-start server
- `qwen-proxy.headless`: Run browser headless

### Environment Variables

- `QWEN_URL`: Override Qwen website URL
- `PROXY_PORT`: Override server port
- `HEADLESS`: Override headless mode
- `DEBUG`: Enable debug logging

## Next Steps Plan

### Immediate (Next 24 hours)

1. Set up basic project structure
2. Test extension activation
3. Verify server starts successfully
4. Test health endpoint

### Short Term (Next Week)

1. Test Puppeteer browser launch
2. Navigate to Qwen website
3. Identify chat input selectors
4. Implement basic message sending

### Medium Term (Next Month)

1. Handle authentication flows
2. Implement streaming responses
3. Add error recovery
4. Performance optimization
5. Documentation and examples

## Success Metrics

- [x] Extension loads without errors
- [x] Server starts on configured port
- [ ] Browser automation connects to Qwen
- [ ] Basic message sending works
- [ ] OpenAI API compatibility verified
- [ ] Integration with coding assistants successful
