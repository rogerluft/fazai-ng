#!/usr/bin/env bash
# Bash completion for Terminal FazAI v3.3-beta
# Installation:
#   sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Or:
#   source completion/fazai-completion.bash

_fazai_completion() {
    local cur prev opts commands models
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    commands="ask config completion search vector import sync cloudflare github"

    # Options/flags
    opts="--help -h --dry-run --cli --debug --verbose --log-file --auto-research --yolo -y"

    # AI models (from config: max 3 per provider)
    # Ollama: gptoss, llama32, llama31
    # OpenRouter: qwen, llama33, gemini
    # OpenAI: gpt4o, gpt4mini
    # Anthropic: sonnet, haiku
    models="gptoss llama32 llama31 qwen llama33 gemini-or gpt4o gpt4mini sonnet haiku gemini3 pro flash flash-lite"

    # Vector subcommands
    vector_opts="validate recreate reset"

    # Import options
    import_opts="--source --recursive -r --no-knowledge --no-learning"
    import_sources="claude chatgpt"

    # First argument (command)
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "${commands} ${models} ${opts}" -- ${cur}) )
        return 0
    fi

    # Handle specific commands
    case "${COMP_WORDS[1]}" in
        ask)
            # No completion for ask (freeform text)
            return 0
            ;;

        config)
            # No arguments for config
            return 0
            ;;

        completion)
            # No arguments for completion
            return 0
            ;;

        search)
            # No completion for search (freeform text)
            return 0
            ;;

        vector)
            case "${prev}" in
                vector)
                    COMPREPLY=( $(compgen -W "${vector_opts}" -- ${cur}) )
                    return 0
                    ;;
                --provider)
                    COMPREPLY=( $(compgen -W "qdrant" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "--provider --recreate --reset" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;

        import)
            case "${prev}" in
                import)
                    # Suggest file paths
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --source)
                    COMPREPLY=( $(compgen -W "${import_sources}" -- ${cur}) )
                    return 0
                    ;;
                *)
                    if [[ ${cur} == -* ]]; then
                        COMPREPLY=( $(compgen -W "${import_opts}" -- ${cur}) )
                    else
                        COMPREPLY=( $(compgen -f -- ${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;

        sync)
            # No arguments for sync
            return 0
            ;;

        github)
            github_cmds="auth user repos repo issues issue fork star starred pr help"
            case "${prev}" in
                github)
                    COMPREPLY=( $(compgen -W "${github_cmds}" -- ${cur}) )
                    return 0
                    ;;
                auth)
                    COMPREPLY=( $(compgen -W "login logout status" -- ${cur}) )
                    return 0
                    ;;
                issue)
                    COMPREPLY=( $(compgen -W "create" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "${github_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;

        cloudflare)
            cloudflare_cmds="zones dns workers purge analytics"
            case "${prev}" in
                cloudflare)
                    COMPREPLY=( $(compgen -W "${cloudflare_cmds}" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "${cloudflare_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;

        # Model selected (admin mode)
        gemini3|pro|flash|flash-lite|gemini-or|gpt4mini|gpt4o|gpt4turbo|sonnet35|haiku|llama32|qwen|mistral)
            # Complete with options
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;

        *)
            # Default: options
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

# Register completion
complete -F _fazai_completion fazai
