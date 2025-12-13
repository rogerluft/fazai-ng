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
    commands="ask alias config completion search vector import cloudflare github"

    # Options/flags
    opts="--help -h --dry-run --cli --debug --verbose --log-file --auto-research --yolo -y"

    # AI models - dynamically loaded from fazai config
    if command -v fazai &> /dev/null; then
        # Extract model names from fazai --help or config
        models=$(fazai config 2>/dev/null | grep -oP '(?<=MODELS_)[A-Z]+' | xargs -I {} fazai config 2>/dev/null | grep "MODELS_{}" | cut -d'=' -f2 | tr ',' ' ')
    fi

    # Fallback models if config not available
    if [ -z "$models" ]; then
        models="gemini-3.0-pro-latest gemini-1.5-flash gemini-1.5-flash-lite gemini-1.5-pro claude-3-5-sonnet-latest claude-3-5-haiku-latest gpt-4o gpt-4o-mini llama3.2:latest qwen/qwen3-coder:free"
    fi

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

        alias)
            alias_cmds="list ls show remove rm delete"
            case "${prev}" in
                alias)
                    # Suggest existing aliases or subcommands
                    if [[ -f /etc/fazai/fzalias ]]; then
                        local aliases=$(grep "^alias " /etc/fazai/fzalias 2>/dev/null | sed "s/^alias \([^=]*\)=.*/\1/")
                        COMPREPLY=( $(compgen -W "${alias_cmds} ${aliases}" -- ${cur}) )
                    else
                        COMPREPLY=( $(compgen -W "${alias_cmds}" -- ${cur}) )
                    fi
                    return 0
                    ;;
                list|ls|show)
                    # No additional completion needed
                    return 0
                    ;;
                remove|rm|delete)
                    # Suggest existing alias names for removal
                    if [[ -f /etc/fazai/fzalias ]]; then
                        local aliases=$(grep "^alias " /etc/fazai/fzalias 2>/dev/null | sed "s/^alias \([^=]*\)=.*/\1/")
                        COMPREPLY=( $(compgen -W "${aliases}" -- ${cur}) )
                    fi
                    return 0
                    ;;
                *)
                    # Default to subcommands
                    COMPREPLY=( $(compgen -W "${alias_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
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

        *)
            # Check if current word matches a model name
            for model in $models; do
                if [[ "${COMP_WORDS[1]}" == "$model" ]]; then
                    # Model selected - complete with options
                    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
                    return 0
                fi
            done
            # Default: options
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

# Register completion
complete -F _fazai_completion fazai
