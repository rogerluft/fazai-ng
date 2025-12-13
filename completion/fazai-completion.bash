#!/usr/bin/env bash
# Bash completion for FazAI - Auto-generated
# Installation:
#   sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Or:
#   source completion/fazai-completion.bash

_fazai_completion() {
    local cur prev opts commands models subcmds
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands (auto-generated from app.ts)
    commands="ask config completion alias search vector import sync cloudflare cf github"

    # Options/flags (auto-generated from app.ts)
    opts="--dry-run --cli --debug --verbose --log-file --auto-research --yolo -y --help -h"

    # AI models (auto-generated from models.ts)
    models="gpt-4o gpt-4o-mini claude-3-5-sonnet-latest claude-3-5-haiku-latest gemini-3.0-pro-latest gemini-1.5-flash gemini-1.5-pro llama-3-sonar-small-32k-online qwen2.5:7b"

    # Fallback if models not available
    if [ -z "$models" ]; then
        models="gpt-4o gpt-4o-mini claude-3-5-sonnet-latest claude-3-5-haiku-latest gemini-3.0-pro-latest gemini-1.5-flash qwen2.5:7b"
    fi

    # First argument (command)
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "$commands $models $opts" -- ${cur}) )
        return 0
    fi

    # Handle specific commands
    case "${COMP_WORDS[1]}" in
        ask)
            # Model names for ask command
            COMPREPLY=( $(compgen -W "$models" -- ${cur}) )
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

        alias)
            local alias_cmds="list ls show remove rm delete"
            case "${prev}" in
                alias)
                    if [[ -f /etc/fazai/fzalias ]]; then
                        local aliases=$(grep "^alias " /etc/fazai/fzalias 2>/dev/null | sed "s/^alias \([^=]*\)=.*/\1/")
                        COMPREPLY=( $(compgen -W "${alias_cmds} ${aliases}" -- ${cur}) )
                    else
                        COMPREPLY=( $(compgen -W "${alias_cmds}" -- ${cur}) )
                    fi
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "${alias_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;

        search)
            # Freeform text for search
            return 0
            ;;

        vector)
            local vector_cmds="validate recreate reset"
            case "${prev}" in
                vector)
                    COMPREPLY=( $(compgen -W "${vector_cmds}" -- ${cur}) )
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
                    COMPREPLY=( $(compgen -f -- ${cur}) )
                    return 0
                    ;;
                --source)
                    COMPREPLY=( $(compgen -W "claude chatgpt" -- ${cur}) )
                    return 0
                    ;;
                *)
                    if [[ ${cur} == -* ]]; then
                        COMPREPLY=( $(compgen -W "--source --recursive -r --no-knowledge --no-learning" -- ${cur}) )
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

        cloudflare|cf)
            local cf_cmds="zones dns workers purge analytics"
            case "${prev}" in
                cloudflare|cf)
                    COMPREPLY=( $(compgen -W "${cf_cmds}" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "${cf_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
            ;;

        github)
            local github_cmds="auth user repos issues fork star pr help"
            case "${prev}" in
                github)
                    COMPREPLY=( $(compgen -W "${github_cmds}" -- ${cur}) )
                    return 0
                    ;;
                auth)
                    COMPREPLY=( $(compgen -W "login logout status" -- ${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "${github_cmds}" -- ${cur}) )
                    return 0
                    ;;
            esac
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
