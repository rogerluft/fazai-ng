#compdef fazai
# Zsh completion for Terminal FazAI v3.1-beta
# Installation:
#   mkdir -p ~/.zsh/completion
#   cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

_fazai() {
    local -a commands models opts

    commands=(
        'ask:Ask general AI question without executing commands'
        'alias:Create/manage global bash aliases'
        'config:List configured API keys'
        'completion:Print available CLI completions'
        'search:Manual research via Context7/Web'
        'vector:Manage Qdrant vector collections'
        'import:Import conversations to Qdrant'
        'cloudflare:Manage Cloudflare zones/dns/workers'
        'github:GitHub integration (auth, repos, issues)'
    )

    models=(
        'gpt4mini:GPT-4o-mini (default, fast and cheap)'
        'gpt4o:GPT-4o (latest, most capable)'
        'gpt4turbo:GPT-4 Turbo (high performance)'
        'sonnet35:Claude 3.5 Sonnet (most intelligent)'
        'haiku:Claude 3 Haiku (fast and cheap)'
        'llama32:Llama 3.2 (local)'
        'qwen:Qwen 2.5:7b (local)'
        'mistral:Mistral (local)'
    )

    opts=(
        '--help:Show help message'
        '-h:Show help message'
        '--dry-run:Simulate commands without executing'
        '--cli:Open interactive CLI mode'
        '--debug:Enable debug logging'
        '--verbose:Enable verbose logging'
        '--log-file:Specify log file path'
        '--auto-research:Re-enable automatic research on failures'
        '--yolo:Skip confirmations (dangerous!)'
        '-y:Skip confirmations (dangerous!)'
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
            # Freeform text, no completion
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
        gpt4mini|gpt4o|gpt4turbo|sonnet35|haiku|llama32|qwen|mistral)
            _describe 'fazai options' opts
            ;;
    esac
}

_fazai "$@"
