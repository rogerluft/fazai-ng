import ora, { Ora } from "ora";
import chalk from "chalk";

/**
 * Wrapper para ora spinner com interface simplificada e consistente
 *
 * Uso:
 * ```typescript
 * const spinner = new Spinner();
 * spinner.start("Carregando dados...");
 * // ... operação assíncrona
 * spinner.succeed("Dados carregados com sucesso!");
 * ```
 */
export class Spinner {
  private spinner: Ora | null = null;
  private isActive = false;

  /**
   * Inicia o spinner com uma mensagem
   */
  start(message: string): void {
    if (this.isActive && this.spinner) {
      // Se já está ativo, apenas atualiza o texto
      this.spinner.text = message;
      return;
    }

    this.spinner = ora({
      text: message,
      color: "cyan",
      spinner: "dots",
    }).start();
    this.isActive = true;
  }

  /**
   * Para o spinner e mostra mensagem de sucesso
   */
  succeed(message: string): void {
    if (!this.spinner) {
      console.log(chalk.green("✅ " + message));
      return;
    }

    this.spinner.succeed(chalk.green(message));
    this.isActive = false;
    this.spinner = null;
  }

  /**
   * Para o spinner e mostra mensagem de erro
   */
  fail(message: string): void {
    if (!this.spinner) {
      console.log(chalk.red("✗ " + message));
      return;
    }

    this.spinner.fail(chalk.red(message));
    this.isActive = false;
    this.spinner = null;
  }

  /**
   * Para o spinner e mostra mensagem informativa
   */
  info(message: string): void {
    if (!this.spinner) {
      console.log(chalk.blue("ℹ " + message));
      return;
    }

    this.spinner.info(chalk.blue(message));
    this.isActive = false;
    this.spinner = null;
  }

  /**
   * Para o spinner e mostra mensagem de aviso
   */
  warn(message: string): void {
    if (!this.spinner) {
      console.log(chalk.yellow("⚠ " + message));
      return;
    }

    this.spinner.warn(chalk.yellow(message));
    this.isActive = false;
    this.spinner = null;
  }

  /**
   * Atualiza o texto do spinner sem parar
   */
  update(message: string): void {
    if (this.spinner && this.isActive) {
      this.spinner.text = message;
    }
  }

  /**
   * Para o spinner sem mostrar mensagem final
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.isActive = false;
      this.spinner = null;
    }
  }

  /**
   * Verifica se o spinner está ativo
   */
  get active(): boolean {
    return this.isActive;
  }
}

/**
 * Helper para executar operação com spinner automático
 *
 * @example
 * ```typescript
 * const result = await withSpinner(
 *   "Carregando dados...",
 *   async () => {
 *     const data = await fetchData();
 *     return data;
 *   },
 *   "Dados carregados!",
 *   "Erro ao carregar dados"
 * );
 * ```
 */
export async function withSpinner<T>(
  startMessage: string,
  operation: () => Promise<T>,
  successMessage?: string,
  errorMessage?: string
): Promise<T> {
  const spinner = new Spinner();
  spinner.start(startMessage);

  try {
    const result = await operation();
    spinner.succeed(successMessage || startMessage + " - Concluído");
    return result;
  } catch (error) {
    spinner.fail(errorMessage || startMessage + " - Falhou");
    throw error;
  }
}
