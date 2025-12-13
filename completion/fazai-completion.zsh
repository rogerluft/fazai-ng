#compdef fazai
# Zsh completion for FazAI - Auto-generated
# Installation:
#   mkdir -p ~/.zsh/completion
#   cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

_fazai() {
    local -a commands models opts

    commands=(
        'ask:Ask general AI question without executing commands'
        'config:List configured API keys'
        'completion:Print available CLI completions'
        'alias:Create/manage global bash aliases'
        'search:Manual research via Context7/Web'
        'vector:Valida collections vetoriais (Qdrant)'
        'import:Importa conversas para Qdrant'
        'sync:Sync configuration and settings'
        'cloudflare:Manage Cloudflare (zones, dns, workers)'
        'cf:Cloudflare (alias)'
        'github:GitHub integration (auth, repos, issues, etc)'
    )

    models=(
        'gpt-4o:openai model'
        'gpt-4o-mini:openai model'
        'claude-3-5-sonnet-latest:anthropic model'
        'claude-3-5-haiku-latest:anthropic model'
        'gemini-3.0-pro-latest:google model'
        'gemini-1.5-flash:google model'
        'gemini-1.5-pro:google model'
        'llama-3-sonar-small-32k-online:perplexity model'
        'qwen2.5:7b:ollama model'
    )

    opts=(
        '--dry-run:Simulate commands without executing'
        '--cli:Open interactive CLI mode'
        '--debug:Enable debug logging'
        '--verbose:Enable verbose logging'
        '--log-file:Specify log file path'
        '--auto-research:Re-enable automatic research on failures'
        '--yolo:Skip confirmations (dangerous!)'
        '-y:Skip confirmations (dangerous!)'
        '--help:Show help message'
        '-h:Show help message'
    )

    case "$state" in
        command)
            _describe 'fazai commands' commands
            _describe 'fazai models' models
            _describe 'fazai options' opts
            ;;

        vector)
            local -a vector_cmds
            vector_cmds=(
                'validate:Validate collections (create if needed)'
                'recreate:Recreate all collections (DELETE DATA!)'
                'reset:Reset collections (DELETE DATA!)'
            )
            _describe 'vector subcommands' vector_cmds
            _arguments \
                '--provider[Vector provider]:provider:(qdrant)' \
                '--recreate[Recreate collections]' \
                '--reset[Reset collections]'
            ;;

        import)
            _arguments \
                '1:file:_files' \
                '--source[Source platform]:source:(claude chatgpt)' \
                '--recursive[Process directory recursively]' \
                '-r[Process directory recursively]' \
                '--no-knowledge[Skip knowledge extraction]' \
                '--no-learning[Skip learning extraction]'
            ;;

        ask)
            _describe 'fazai models' models
            ;;

        search)
            # Freeform text, no completion
            ;;

        config)
            # No arguments
            ;;

        completion)
            # No arguments
            ;;
    esac

    _arguments \
        '1:command:->command' \
        '*::arg:->args'

    case "$words[1]" in
        ask|search|config|completion)
            state=$words[1]
            ;;
        vector)
            state=vector
            ;;
        import)
            state=import
            ;;
    esac
}

_fazai "$@"
