
import { vi, describe, it, expect, beforeEach, afterEach, SpyInstance } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { runCliMode } from '../src/cli-mode';
import { logger } from '../src/logger';
import * as linuxAdmin from '../src/linux-admin';
import * as memory from '../src/memory';
import { LinuxCommandExecutor } from '../src/linux-executor';
import { AgenticWebCrawler } from '../src/research/web-crawler';
import { QueryAnalyzer } from '../src/research/query-analyzer';
import { askAI } from '../src/askAI';
import * as apiStatus from '../src/services/api-status-checker';
import * as ui from '../src/ui/dashboard';
import { promisify } from 'util';
import { exec } from 'child_process';

// Mock readline to simulate CLI user input
const mockRl = new (EventEmitter as any)();
mockRl.prompt = vi.fn();
mockRl.close = vi.fn();
mockRl.history = [];
vi.mock('readline', () => ({
  createInterface: vi.fn(() => mockRl),
  default: {
    createInterface: vi.fn(() => mockRl),
  },
}));

// Mock logger to capture output
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock memory functions to avoid file system interactions
vi.mock('../src/memory', async () => {
    const actual = await vi.importActual('../src/memory');
    return {
        ...actual,
        loadConversationHistory: vi.fn().mockReturnValue([]),
        loadCommandHistory: vi.fn().mockReturnValue([]),
        appendCommandHistory: vi.fn(),
        appendConversationEntry: vi.fn(),
        clearPersistentHistory: vi.fn(),
    };
});

// Mock API key utils
vi.mock('../src/apiKeyUtils-fazai', () => ({
  checkAPIKey: vi.fn().mockReturnValue(true),
  getAndSetAPIKey: vi.fn(),
}));

// Mock system info collection
vi.mock('../src/system-info', () => ({
    collectSystemInfo: vi.fn().mockResolvedValue({
        os: 'Linux',
        distro: 'Ubuntu',
        kernel: '5.4.0',
        cpu: 'Intel i7',
        memory: { total: 16, used: 8, free: 8 },
        services: [],
    }),
}));

// Mock the command executor to avoid running real commands
vi.mock('../src/linux-executor');

// Mock the research modules
vi.mock('../src/research/web-crawler');
vi.mock('../src/research/query-analyzer');

// Mock the API status checker
vi.mock('../src/services/api-status-checker');
// Mock the dashboard UI to spy on its calls
vi.mock('../src/ui/dashboard');

// Mock askAI to control chat responses
vi.mock('../src/askAI');

// Mock child_process.exec to prevent real shell commands
vi.mock('child_process', () => ({
    exec: vi.fn((_command, callback) => callback(null, { stdout: 'mocked', stderr: '' })),
}));

// Mock error-tracker to prevent dependency on the real tracker
vi.mock('../src/error-tracker', () => ({
    errorTracker: {
        getRecentErrors: vi.fn().mockReturnValue([]),
    },
}));


describe('FazAI CLI Tests', () => {
    let getLinuxCommandsFromAISpy: SpyInstance;

    // Centralized setup that runs before each test in this suite
    beforeEach(async () => {
        vi.clearAllMocks();
        // This is crucial to prevent listeners from stacking up on the singleton mockRl
        mockRl.removeAllListeners('line');
        // Reset history mocks for a clean slate
        vi.mocked(memory.loadCommandHistory).mockReturnValue([]);
        mockRl.history = [];

        // Start the CLI, which attaches its 'line' listener
        await runCliMode();
        // Spy on the AI function after setup
        getLinuxCommandsFromAISpy = vi.spyOn(linuxAdmin, 'getLinuxCommandsFromAI');
    });

    afterEach(() => {
        // Restore any spies
        if (getLinuxCommandsFromAISpy) {
            getLinuxCommandsFromAISpy.mockRestore();
        }
    });

    describe('Command Parsing', () => {
        it('should display the help message when the /help command is entered', async () => {
            // Act: Simulate user typing '/help'
            mockRl.emit('line', '/help');
            await new Promise(setImmediate);

            // Assert: Check if the logger was called with the help content
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Comandos disponíveis:'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('/exec'));
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('/history'));
            expect(mockRl.prompt).toHaveBeenCalled();
        });

        it('should display command history when the /history command is entered', async () => {
            // Arrange: Simulate entering commands to populate the history buffer
            mockRl.emit('line', 'first command');
            mockRl.emit('line', 'second command');
            await new Promise(setImmediate); // Let the line events process
            vi.mocked(logger.info).mockClear(); // Clear logs from the arrangement phase

            // Act: Simulate user typing '/history'
            mockRl.emit('line', '/history');
            await new Promise(setImmediate);

            // Assert: Check if the correct history is logged in order
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Histórico recente:'));
            const infoCalls = vi.mocked(logger.info).mock.calls;
            // Find the calls that are logging the history items
            const historyLogs = infoCalls.filter(call => /^\d+\./.test(call[0]));
            expect(historyLogs[0][0]).toContain('1. first command');
            expect(historyLogs[1][0]).toContain('2. second command');
            expect(mockRl.prompt).toHaveBeenCalled();
        });

        it('should clear command history when the "/history clear" command is entered', async () => {
             // Arrange
        const clearHistorySpy = vi.spyOn(memory, 'clearPersistentHistory');

        // Act
        mockRl.emit('line', '/history clear');
        await new Promise(setImmediate);

        // Assert
        expect(clearHistorySpy).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Histórico de comandos limpo'));
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should correctly parse the /exec command and trigger command generation', async () => {
        // Arrange: Mock the AI response to be a simple command stream
        const mockCommandStream = Readable.from([
            { type: 'command', command: { command: 'ls -la', explanation: 'list files', risk: 'LOW' } },
            { type: 'allcommands' }
        ]);
        getLinuxCommandsFromAISpy.mockReturnValue(mockCommandStream);

        // Mock the executor
        const executeCommandSpy = vi.spyOn(LinuxCommandExecutor.prototype, 'executeCommand').mockResolvedValue({ success: true, output: 'files' });


        // Act: Simulate user typing '/exec list all files'
        const task = 'list all files';
        mockRl.emit('line', `/exec ${task}`);

        // Wait for async operations and stream processing to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert
        expect(getLinuxCommandsFromAISpy).toHaveBeenCalledWith(
            expect.any(Object), // systemInfo
            task,
            expect.any(String), // model name
            expect.any(String)  // model provider
        );
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Gerando comandos para:'), expect.stringContaining(task));
        expect(executeCommandSpy).toHaveBeenCalledWith({ command: 'ls -la', explanation: 'list files', risk: 'LOW' });
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should handle /exec with no task provided', async () => {
        // Act
        mockRl.emit('line', '/exec');
        await new Promise(setImmediate);

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Forneça uma instrução após /exec'));
        expect(getLinuxCommandsFromAISpy).not.toHaveBeenCalled();
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should handle multi-line /exec commands using triple quotes', async () => {
         // Arrange
         const mockCommandStream = Readable.from([
            { type: 'allcommands' }
        ]);
        getLinuxCommandsFromAISpy.mockReturnValue(mockCommandStream);
        const task = 'line 1\nline 2';

        // Act
        mockRl.emit('line', `/exec '''${task}'''`);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert
        expect(getLinuxCommandsFromAISpy).toHaveBeenCalledWith(
            expect.any(Object),
            task,
            expect.any(String),
            expect.any(String)
        );
    });
});

    describe('Search Functionality', () => {
    it('should trigger web search on intent keyword and display results', async () => {
        // Arrange
        const query = 'nginx reverse proxy';
        const mockSearchResults = [
            { title: 'Nginx Docs', link: 'https://nginx.org', snippet: 'Official documentation...', source: 'web', category: 'docs' },
        ];
        const mockConsolidatedResult = {
            consensus: ['Nginx is a web server.'],
            contradictions: [],
            summary: 'A powerful web server.',
            sources: ['web', 'docs'],
        };

        vi.mocked(QueryAnalyzer.prototype.classifyQuery).mockReturnValue({
            type: 'technical',
            strategy: { description: 'test strategy', sources: ['web'], maxResults: 1 },
        });
        vi.mocked(AgenticWebCrawler.prototype.searchMultiSource).mockResolvedValue(mockSearchResults);
        vi.mocked(AgenticWebCrawler.prototype.crossReference).mockResolvedValue(mockConsolidatedResult);
        vi.mocked(AgenticWebCrawler.prototype.cacheInQdrant).mockResolvedValue(undefined);

        // Act
        mockRl.emit('line', `pesquise sobre ${query}`);
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow async operations to complete

        // Assert
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Iniciando busca multi-fonte: "${query}"`));
        expect(AgenticWebCrawler.prototype.searchMultiSource).toHaveBeenCalledWith(query, expect.any(Object));
        expect(AgenticWebCrawler.prototype.crossReference).toHaveBeenCalledWith(mockSearchResults);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('TOP RESULTADOS:'));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Nginx Docs'));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('RESUMO:'));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(mockConsolidatedResult.summary));
        expect(AgenticWebCrawler.prototype.cacheInQdrant).toHaveBeenCalledWith(query, mockSearchResults);
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should show a warning if web search returns no results', async () => {
        // Arrange
        const query = 'some obscure topic';
        vi.mocked(QueryAnalyzer.prototype.classifyQuery).mockReturnValue({
            type: 'technical',
            strategy: { description: 'test strategy', sources: ['web'], maxResults: 1 },
        });
        vi.mocked(AgenticWebCrawler.prototype.searchMultiSource).mockResolvedValue([]);

        // Act
        mockRl.emit('line', `busque ${query}`);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Nenhum resultado encontrado.'));
        expect(AgenticWebCrawler.prototype.crossReference).not.toHaveBeenCalled();
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should handle errors during the search process gracefully', async () => {
        // Arrange
        const query = 'a query that fails';
        const errorMessage = 'Search API is down';
        vi.mocked(QueryAnalyzer.prototype.classifyQuery).mockReturnValue({
            type: 'technical',
            strategy: { description: 'test strategy', sources: ['web'], maxResults: 1 },
        });
        vi.mocked(AgenticWebCrawler.prototype.searchMultiSource).mockRejectedValue(new Error(errorMessage));

        // Act
        mockRl.emit('line', `procure sobre ${query}`);
        await new Promise(resolve => setTimeout(resolve, 50));

        // Assert
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Erro na busca: ${errorMessage}`));
        expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should prompt for a query if search intent is detected without one', async () => {
        // Act
        mockRl.emit('line', 'pesquise sobre');
        await new Promise(setImmediate);

        // Assert
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Por favor, especifique o que deseja pesquisar.'));
        expect(AgenticWebCrawler.prototype.searchMultiSource).not.toHaveBeenCalled();
        expect(mockRl.prompt).toHaveBeenCalled();
    });
});
    describe('API Status and Dashboard', () => {
        it('should call the dashboard UI with correct data when /dashboard is entered', async () => {
            // Arrange
            const mockApiStatusResults = [
                { name: 'Cloudflare', status: 'online', responseTime: 123 },
                { name: 'OpenAI', status: 'offline', responseTime: 5000 },
            ];
             // In your test file, before the test runs
            vi.spyOn(apiStatus, 'checkAllAPIs').mockResolvedValue(mockApiStatusResults);
            const showDashboardSpy = vi.spyOn(ui, 'showDashboard');

            // Act
            mockRl.emit('line', '/dashboard');
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            expect(apiStatus.checkAllAPIs).toHaveBeenCalled();
            expect(showDashboardSpy).toHaveBeenCalled();

            // Optionally, check the structure of the data passed to the UI function
            const dashboardData = showDashboardSpy.mock.calls[0][0];
            expect(dashboardData).toHaveProperty('system');
            expect(dashboardData).toHaveProperty('recentCommands');
            expect(dashboardData.apiStatus).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Cloudflare', status: 'online' }),
                    expect.objectContaining({ name: 'OpenAI', status: 'offline' }),
                ])
            );
        });
    });
    describe('Error Handling', () => {
        it('should show a warning for an unrecognized command', async () => {
            // Arrange
            const unrecognizedCommand = '/foobar';

            // Act
            mockRl.emit('line', unrecognizedCommand);
            await new Promise(setImmediate);

            // Assert
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Comando não reconhecido. Use /help para ver as opções.'));
            expect(mockRl.prompt).toHaveBeenCalled();
        });

        it('should not process an empty line and should re-prompt', async () => {
            // Arrange
            // The main beforeEach has run. Now we clear the mock history to test the specific action.
            vi.mocked(logger.info).mockClear();
            vi.mocked(logger.warn).mockClear();
            vi.mocked(logger.error).mockClear();
            getLinuxCommandsFromAISpy.mockClear();
            vi.mocked(mockRl.prompt).mockClear();

            // Act
            mockRl.emit('line', '');
            await new Promise(setImmediate);

            // Assert
            // No new logs or core logic should be triggered
            expect(logger.info).not.toHaveBeenCalled();
            expect(logger.warn).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
            expect(getLinuxCommandsFromAISpy).not.toHaveBeenCalled();
            // Only a new prompt should appear
            expect(mockRl.prompt).toHaveBeenCalledTimes(1);
        });
    });
    describe('Full Session Integration and Timeout', () => {
        beforeEach(() => {
            // Use fake timers to control timeouts in tests
            vi.useFakeTimers();
        });

        afterEach(() => {
            // Restore real timers after each test
            vi.useRealTimers();
        });

        it('should handle a mixed session of chat and commands, then exit on timeout', async () => {
            // Arrange
            const chatMessage = 'hello';
            const chatResponse = 'world';
            const mockChatStream = Readable.from([chatResponse]);
            const mockCommandStream = Readable.from([
                { type: 'command', command: { command: 'echo "test"', explanation: 'test', risk: 'LOW' } },
                { type: 'allcommands' }
            ]);

            vi.mocked(askAI).mockReturnValue(mockChatStream);
            getLinuxCommandsFromAISpy.mockReturnValue(mockCommandStream);
            const executeCommandSpy = vi.spyOn(LinuxCommandExecutor.prototype, 'executeCommand').mockResolvedValue({ success: true, output: '' });
            const closeSpy = vi.spyOn(mockRl, 'close');


            // Act 1: User sends a chat message
            mockRl.emit('line', chatMessage);
            await vi.advanceTimersByTimeAsync(50); // Allow event to process

            // Assert 1: Check chat functionality
            expect(askAI).toHaveBeenCalled();
            // In a real stream, the output would be written to stdout. We can't easily check that,
            // but we can check that the conversation history was updated.
            expect(memory.appendConversationEntry).toHaveBeenCalledWith(expect.objectContaining({ role: 'user', content: chatMessage }));
            expect(memory.appendConversationEntry).toHaveBeenCalledWith(expect.objectContaining({ role: 'assistant', content: chatResponse }));

            // Act 2: User executes a command
            mockRl.emit('line', '/exec test command');
            await vi.advanceTimersByTimeAsync(50);

            // Assert 2: Check command execution
            expect(getLinuxCommandsFromAISpy).toHaveBeenCalledWith(expect.any(Object), 'test command', expect.any(String), expect.any(String));
            expect(executeCommandSpy).toHaveBeenCalled();

            // Act 3: Simulate user inactivity and trigger timeout
            // Assuming the timeout is set to 300000 ms (5 minutes) in the actual code
            // We advance the timers to just past that point.
            await vi.advanceTimersByTimeAsync(300001);

            // Assert 3: Check for timeout and graceful exit
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Inatividade detectada, encerrando a sessão.'));
            expect(closeSpy).toHaveBeenCalled();
        });
    });
});
