import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { findBlocksForIntents, resetBlockStorage } from '../../src/agentic/block-storage/factory';
import fs from 'fs';
import path from 'path';

describe('Block Storage Factory - findBlocksForIntents (Integration)', () => {
  const tempJson = path.resolve(process.cwd(), "tests-blocks.json");
  const tempConf = path.resolve(process.cwd(), "tests-fazai.conf");

  beforeEach(() => {
    // Setup temporary config
    fs.writeFileSync(tempConf, `EXECUTION_BLOCKS_BACKEND=json\nEXECUTION_BLOCKS_PATH=${tempJson}\n`);
    process.env.FAZAI_CONFIG_PATH = tempConf;

    // Setup temporary blocks
    const dummyBlocks = [
      {
        block_id: "id-install",
        intent: "install nginx",
        commands: ["echo test"],
        stats: { times_used: 1, success_rate: 1.0, last_used: new Date().toISOString() }
      },
      {
        block_id: "id-status",
        intent: "check status",
        commands: ["echo status"],
        stats: { times_used: 1, success_rate: 1.0, last_used: new Date().toISOString() }
      }
    ];
    fs.writeFileSync(tempJson, JSON.stringify(dummyBlocks));

    resetBlockStorage();
  });

  afterAll(() => {
    if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson);
    if (fs.existsSync(tempConf)) fs.unlinkSync(tempConf);
    delete process.env.FAZAI_CONFIG_PATH;
  });

  it('should return a map with results for each intent', async () => {
    const intents = ['install nginx', 'check status'];
    const results = await findBlocksForIntents(intents, undefined, 0.1);

    expect(results.size).toBe(2);
    expect(results.get('install nginx')).not.toBeNull();
    expect(results.get('check status')).not.toBeNull();
    expect(results.get('install nginx')?.block.block_id).toBe('id-install');
  });

  it('should handle empty results for unmatched intent', async () => {
    const intents = ['something completely different'];
    const results = await findBlocksForIntents(intents, undefined, 0.9);

    expect(results.get('something completely different')).toBeNull();
  });

  it('should work with empty intents array', async () => {
    const results = await findBlocksForIntents([]);
    expect(results.size).toBe(0);
  });
});
