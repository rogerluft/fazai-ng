# FazAI - Módulo de Sistema

Este diretório contém o código fonte para o módulo de sistema do FazAI, que permite interação de baixo nível com o sistema operacional.

## Estrutura

- `fazai_mod.h`: Arquivo de cabeçalho com as definições das funções exportadas.
- `system_mod.c`: Implementação do módulo em C.

## Compilação

Para compilar o módulo, você precisará do `gcc` instalado. Execute o seguinte comando:

```bash
gcc -shared -fPIC -o system_mod.so system_mod.c
```

Isso gerará o arquivo `system_mod.so`, que pode ser carregado dinamicamente pelo FazAI.

## Uso

O módulo exporta as seguintes funções:

- `int fazai_mod_init()`: Inicializa o módulo. Retorna 0 em caso de sucesso.
- `int fazai_mod_exec(const char* cmd, char* result, int result_len)`: Executa um comando.
  - `cmd`: Comando a ser executado (ex: "system_info", "create_user ...").
  - `result`: Buffer para armazenar o resultado.
  - `result_len`: Tamanho do buffer de resultado.
  - Retorna 0 em caso de sucesso, -1 em caso de erro.
- `void fazai_mod_cleanup()`: Finaliza o módulo e libera recursos.

## Comandos Suportados

- `system_info`: Retorna informações detalhadas sobre o sistema (OS, kernel, memória, etc).
- `create_user <username> <password> <group>`: Cria um novo usuário no sistema.
- `change_ssh_port <port>`: Altera a porta do servidor SSH.

## Integração com Node.js

Para utilizar este módulo em Node.js, recomenda-se o uso de `ffi-napi` para carregar a biblioteca compartilhada `.so` e chamar as funções exportadas.

Exemplo:

```javascript
const ffi = require('ffi-napi');
const path = require('path');

const lib = ffi.Library(path.join(__dirname, 'system_mod.so'), {
  'fazai_mod_init': ['int', []],
  'fazai_mod_exec': ['int', ['string', 'char*', 'int']],
  'fazai_mod_cleanup': ['void', []]
});

// Inicializar
lib.fazai_mod_init();

// Executar comando
const buffer = Buffer.alloc(8192);
lib.fazai_mod_exec('system_info', buffer, 8192);
console.log(buffer.toString('utf-8').replace(/\0/g, ''));

// Finalizar
lib.fazai_mod_cleanup();
```
