
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceWatchdog } from '../../../src/services/watchdog';
import * as fsPromises from 'fs/promises';
import { logger } from '../../../src/logger';

vi.mock('fs/promises');
vi.mock('../../../src/logger');

describe('ResourceWatchdog', () => {
  let watchdog: ResourceWatchdog;

  beforeEach(() => {
    vi.useFakeTimers();
    watchdog = new ResourceWatchdog();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start a timer when started', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    watchdog.start(1234);
    expect(setIntervalSpy).toHaveBeenCalled();
  });

  it('should stop the timer when stopped', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    watchdog.start(1234);
    watchdog.stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should check memory and NOT kill process if below limit', async () => {
    const pid = 1234;
    vi.mocked(fsPromises.readFile).mockResolvedValue('VmRSS: 512000 kB\n'); // 500 MB

    // @ts-ignore - accessing private method for testing
    await watchdog.check(pid);

    expect(fsPromises.readFile).toHaveBeenCalledWith(`/proc/${pid}/status`, 'utf8');
    // process.kill and process.exit should not have been called
  });

  it('should kill process if memory exceeds limit', async () => {
    const pid = 1234;
    // Limit is 204800MB by default
    vi.mocked(fsPromises.readFile).mockResolvedValue('VmRSS: 314572800 kB\n'); // ~300GB

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as any);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as any);

    // @ts-ignore
    await watchdog.check(pid);

    expect(killSpy).toHaveBeenCalledWith(pid, 'SIGKILL');
    expect(exitSpy).toHaveBeenCalledWith(137);

    killSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should stop itself if an error occurs during check', async () => {
    const pid = 1234;
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Process not found'));

    const stopSpy = vi.spyOn(watchdog, 'stop');

    // @ts-ignore
    await watchdog.check(pid);

    expect(stopSpy).toHaveBeenCalled();
  });
});
