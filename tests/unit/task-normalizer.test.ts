import { describe, it, expect } from 'vitest';
import { normalizeTask, validateNormalization } from '../../src/utils/task-normalizer';

describe('Task Normalizer - Comma Disambiguation', () => {
  describe('Sequential Task Normalization', () => {
    it('should normalize simple sequential tasks', () => {
      const input = "instalar nginx, configurar porta 80";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
      expect(output).toBe("instalar nginx e depois configurar porta 80");
    });

    it('should handle multiple commas', () => {
      const input = "instalar pacote, configurar serviço, reiniciar";
      const output = normalizeTask(input);

      const connectorCount = (output.match(/e depois/g) || []).length;
      expect(connectorCount).toBe(2);
    });

    it('should handle gerund verbs', () => {
      const input = "verificando logs, buscando erros";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
    });
  });

  describe('Preservation of Temporal Markers', () => {
    it('should not modify tasks with "em seguida"', () => {
      const input = "instalar nginx, em seguida configurar proxy";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify tasks with "depois"', () => {
      const input = "verificar status, depois reiniciar";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify tasks with "então"', () => {
      const input = "parar serviço, então fazer backup";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });
  });

  describe('Enumeration Detection', () => {
    it('should not modify numbered lists', () => {
      const input = "primeiro listar, segundo filtrar, terceiro exibir";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });

    it('should not modify ordinal lists', () => {
      const input = "1º verificar, 2º corrigir, 3º validar";
      const output = normalizeTask(input);

      expect(output).toBe(input);
    });
  });

  describe('Complex Real-World Cases', () => {
    it('should handle the original TODO.md bug case', () => {
      const input = "procure nos arquivos que desencadeiam ações ao logar com o usuário rluft e localize onde é executado o comando screen ao logar, em seguida exiba o resultado";
      const output = normalizeTask(input);

      // Should not modify (already has "em seguida")
      expect(output).toBe(input);
    });

    it('should normalize installation + configuration', () => {
      const input = "instalar docker, configurar daemon, criar container";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
      expect(output).not.toBe(input);
    });

    it('should handle diagnostic tasks', () => {
      const input = "listar processos apache, verificar logs erro";
      const output = normalizeTask(input);

      expect(output).toContain("e depois");
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(normalizeTask('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(normalizeTask(null as any)).toBe(null);
      expect(normalizeTask(undefined as any)).toBe(undefined);
    });

    it('should handle tasks without commas', () => {
      const input = "instalar nginx e configurar proxy";
      expect(normalizeTask(input)).toBe(input);
    });

    it('should handle single-word tasks', () => {
      const input = "reboot";
      expect(normalizeTask(input)).toBe(input);
    });
  });

  describe('Validation Function', () => {
    it('should detect improvement when connector added', () => {
      const original = "instalar nginx, configurar porta 80";
      const normalized = "instalar nginx e depois configurar porta 80";

      const result = validateNormalization(original, normalized);

      expect(result.improved).toBe(true);
      expect(result.reason).toContain('temporal connector');
    });

    it('should detect no improvement when unchanged', () => {
      const task = "instalar nginx e configurar proxy";
      const result = validateNormalization(task, task);

      expect(result.improved).toBe(false);
    });
  });
});
