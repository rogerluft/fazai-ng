# FazAI Alias Manager - Bash Completion
# Version: 3.1.0-beta
# Part of: FazAI Terminal Assistant

_fzalias_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    opts="add remove list install uninstall help"

    case "${prev}" in
        fzalias)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        add)
            # Suggest common alias patterns
            local suggestions="'aliasname=\"command\"'"
            COMPREPLY=( $(compgen -W "${suggestions}" -- ${cur}) )
            return 0
            ;;
        remove)
            # Get existing aliases from /etc/fazai/fzalias
            if [[ -f /etc/fazai/fzalias ]]; then
                local existing_aliases=$(grep -oP "^alias \K[^=]+" /etc/fazai/fzalias 2>/dev/null)
                COMPREPLY=( $(compgen -W "${existing_aliases}" -- ${cur}) )
            fi
            return 0
            ;;
        *)
            ;;
    esac

    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
    return 0
}

complete -F _fzalias_completion fzalias
