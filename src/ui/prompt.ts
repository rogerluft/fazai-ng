import { select, confirm, input, password } from "@inquirer/prompts";
import chalk from "chalk";

/**
 * Opção para menus de seleção
 */
export interface SelectOption {
  /** Valor retornado quando a opção é selecionada */
  value: string;
  /** Nome exibido no menu */
  name?: string;
  /** Descrição adicional (exibida abaixo do nome) */
  description?: string;
  /** Se true, esta opção não pode ser selecionada */
  disabled?: boolean | string;
}

/**
 * Exibe menu de seleção com suporte a descrições e valores disabled
 *
 * @param message - Pergunta exibida ao usuário
 * @param choices - Array de opções (strings ou objetos SelectOption)
 * @returns Promise com o valor da opção selecionada
 *
 * @example
 * ```typescript
 * const action = await selectOption("Escolha uma ação:", [
 *   { value: "create", name: "Criar novo", description: "Cria um novo recurso" },
 *   { value: "delete", name: "Deletar", description: "Remove recurso existente" },
 *   { value: "exit", name: "Sair" }
 * ]);
 * ```
 */
export async function selectOption(
  message: string,
  choices: (string | SelectOption)[]
): Promise<string> {
  const formattedChoices = choices.map((choice) => {
    if (typeof choice === "string") {
      return { value: choice, name: choice };
    }
    return {
      value: choice.value,
      name: choice.name || choice.value,
      description: choice.description,
      disabled: choice.disabled,
    };
  });

  return await select({
    message: chalk.cyan(message),
    choices: formattedChoices,
  });
}

/**
 * Exibe prompt de confirmação (Sim/Não)
 *
 * @param message - Pergunta exibida ao usuário
 * @param defaultValue - Valor padrão (true = Sim, false = Não)
 * @returns Promise com boolean (true = Sim, false = Não)
 *
 * @example
 * ```typescript
 * const confirmed = await confirmAction("Deseja continuar?");
 * if (confirmed) {
 *   console.log("Continuando...");
 * }
 * ```
 */
export async function confirmAction(
  message: string,
  defaultValue = false
): Promise<boolean> {
  return await confirm({
    message: chalk.yellow(message),
    default: defaultValue,
  });
}

/**
 * Exibe prompt para entrada de texto
 *
 * @param message - Pergunta exibida ao usuário
 * @param defaultValue - Valor padrão exibido
 * @param validate - Função de validação opcional
 * @returns Promise com o texto digitado
 *
 * @example
 * ```typescript
 * const name = await inputText(
 *   "Digite o nome:",
 *   "default-name",
 *   (value) => value.length > 0 || "Nome não pode ser vazio"
 * );
 * ```
 */
export async function inputText(
  message: string,
  defaultValue?: string,
  validate?: (value: string) => boolean | string | Promise<boolean | string>
): Promise<string> {
  return await input({
    message: chalk.cyan(message),
    default: defaultValue,
    validate,
  });
}

/**
 * Exibe prompt para entrada de senha (caracteres ocultos)
 *
 * @param message - Pergunta exibida ao usuário
 * @param validate - Função de validação opcional
 * @returns Promise com a senha digitada
 *
 * @example
 * ```typescript
 * const apiKey = await inputSecret(
 *   "Digite sua API key:",
 *   (value) => value.length >= 32 || "API key deve ter pelo menos 32 caracteres"
 * );
 * ```
 */
export async function inputSecret(
  message: string,
  validate?: (value: string) => boolean | string | Promise<boolean | string>
): Promise<string> {
  return await password({
    message: chalk.cyan(message),
    mask: "*",
    validate,
  });
}

/**
 * Exibe menu numerado com descrições (estilo mais visual)
 *
 * @param message - Título do menu
 * @param choices - Array de opções com descrição
 * @returns Promise com o valor da opção selecionada
 *
 * @example
 * ```typescript
 * const choice = await selectWithDescription("Gerenciar Cloudflare:", [
 *   { value: "zones", name: "Zonas DNS", description: "Gerenciar zonas e domínios" },
 *   { value: "workers", name: "Workers", description: "Gerenciar Cloudflare Workers" },
 * ]);
 * ```
 */
export async function selectWithDescription(
  message: string,
  choices: SelectOption[]
): Promise<string> {
  console.log(chalk.cyan.bold(`\n${message}\n`));

  const formattedChoices = choices.map((choice, index) => ({
    value: choice.value,
    name: `${chalk.cyan((index + 1).toString().padStart(2))}. ${choice.name || choice.value}`,
    description: choice.description
      ? chalk.gray(`   ${choice.description}`)
      : undefined,
    disabled: choice.disabled,
  }));

  return await select({
    message: chalk.gray("Selecione uma opção:"),
    choices: formattedChoices,
  });
}

/**
 * Exibe prompt de múltipla escolha (aceita validação customizada)
 *
 * @param message - Pergunta exibida
 * @param choices - Lista de opções
 * @param validator - Validação do input (retorna true se válido ou mensagem de erro)
 * @returns Promise com o valor digitado
 */
export async function inputWithValidation(
  message: string,
  choices?: string[],
  validator?: (value: string) => boolean | string
): Promise<string> {
  let validate: ((value: string) => boolean | string) | undefined;

  if (choices && choices.length > 0) {
    console.log(chalk.gray(`Opções válidas: ${choices.join(", ")}`));
    validate = (value: string) => {
      if (!choices.includes(value)) {
        return `Valor inválido. Escolha entre: ${choices.join(", ")}`;
      }
      return validator ? validator(value) : true;
    };
  } else {
    validate = validator;
  }

  return await input({
    message: chalk.cyan(message),
    validate,
  });
}
