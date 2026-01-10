#!/bin/bash
# =============================================================================
# Qdrant JWT Token Generator
# =============================================================================
# Gera tokens JWT para controle de acesso granular por collection
#
# Uso:
#   ./generate-jwt.sh <profile> [expiry_days]
#
# Profiles disponiveis:
#   master   - Acesso total (manage) - usar no walker localhost
#   claudio  - RO replicadas + RW claudio_* - usar no papaimach
#   readonly - Somente leitura global
#   fazai    - RW em fazai_* apenas
#
# Exemplo:
#   QDRANT_API_KEY=sua_chave ./generate-jwt.sh claudio 365
#
# Dependencias:
#   - openssl (para HMAC-SHA256)
#   - base64
# =============================================================================

set -euo pipefail

# Carregar API key
API_KEY="${QDRANT_API_KEY:-}"

# Tentar carregar do fazai.conf se nao definida
if [[ -z "$API_KEY" ]]; then
    FAZAI_CONF="${FAZAI_CONFIG_PATH:-/etc/fazai/fazai.conf}"
        if [[ -f "$FAZAI_CONF" ]]; then
                source "$FAZAI_CONF" 2>/dev/null || true
                        API_KEY="${QDRANT_API_KEY:-}"
                            fi
                            fi

                            if [[ -z "$API_KEY" ]]; then
                                echo "ERRO: QDRANT_API_KEY nao definida"
                                    echo "Defina via variavel de ambiente ou no /etc/fazai/fazai.conf"
                                        exit 1
                                        fi

                                        PROFILE="${1:-}"
                                        EXPIRY_DAYS="${2:-365}"

                                        if [[ -z "$PROFILE" ]]; then
                                            echo "Uso: $0 <profile> [expiry_days]"
                                                echo ""
                                                    echo "Profiles:"
                                                        echo "  master   - Acesso total (manage)"
                                                            echo "  claudio  - RO replicadas + RW claudio_*"
                                                                echo "  readonly - Somente leitura global"
                                                                    echo "  fazai    - RW em fazai_* apenas"
                                                                        exit 1
                                                                        fi

                                                                        # Calcular timestamp de expiracao
                                                                        EXPIRY=$(date -d "+${EXPIRY_DAYS} days" +%s 2>/dev/null || \
                                                                                 date -v "+${EXPIRY_DAYS}d" +%s 2>/dev/null)

                                                                                 # Base64url encode (RFC 4648)
                                                                                 b64url_encode() {
                                                                                     openssl base64 -e -A | tr '+/' '-_' | tr -d '='
                                                                                     }

                                                                                     # Definir payload baseado no profile
                                                                                     case "$PROFILE" in
                                                                                         master)
                                                                                                 PAYLOAD=$(cat <<EOF
                                                                                                 {"exp":${EXPIRY},"access":"m"}
                                                                                                 EOF
                                                                                                 )
                                                                                                         ;;
                                                                                                             
                                                                                                                 claudio)
                                                                                                                         PAYLOAD=$(cat <<EOF
                                                                                                                         {"exp":${EXPIRY},"access":[{"collection":"fazai_learning","access":"r"},{"collection":"fazai_memory","access":"r"},{"collection":"fazai_inference","access":"r"},{"collection":"fazai_kb","access":"r"},{"collection":"fazai_semantic_cache","access":"r"},{"collection":"fazai_source","access":"r"},{"collection":"fazai_personality","access":"r"},{"collection":"source","access":"r"},{"collection":"terraforming","access":"r"},{"collection":"claudio_soul","access":"rw"},{"collection":"claudio_sources","access":"rw"}]}
                                                                                                                         EOF
                                                                                                                         )
                                                                                                                                 ;;
                                                                                                                                     
                                                                                                                                         readonly)
                                                                                                                                                 PAYLOAD=$(cat <<EOF
                                                                                                                                                 {"exp":${EXPIRY},"access":"r"}
                                                                                                                                                 EOF
                                                                                                                                                 )
                                                                                                                                                         ;;
                                                                                                                                                             
                                                                                                                                                                 fazai)
                                                                                                                                                                         PAYLOAD=$(cat <<EOF
                                                                                                                                                                         {"exp":${EXPIRY},"access":[{"collection":"fazai_learning","access":"rw"},{"collection":"fazai_memory","access":"rw"},{"collection":"fazai_inference","access":"rw"},{"collection":"fazai_kb","access":"rw"},{"collection":"fazai_semantic_cache","access":"rw"},{"collection":"fazai_source","access":"rw"},{"collection":"fazai_personality","access":"rw"}]}
                                                                                                                                                                         EOF
                                                                                                                                                                         )
                                                                                                                                                                                 ;;
                                                                                                                                                                                     
                                                                                                                                                                                         *)
                                                                                                                                                                                                 echo "ERRO: Profile desconhecido: $PROFILE"
                                                                                                                                                                                                         exit 1
                                                                                                                                                                                                                 ;;
                                                                                                                                                                                                                 esac
                                                                                                                                                                                                                 
                                                                                                                                                                                                                 # Header JWT (HS256)
                                                                                                                                                                                                                 HEADER='{"alg":"HS256","typ":"JWT"}'
                                                                                                                                                                                                                 
                                                                                                                                                                                                                 # Gerar componentes do token
                                                                                                                                                                                                                 HEADER_B64=$(echo -n "$HEADER" | b64url_encode)
                                                                                                                                                                                                                 PAYLOAD_B64=$(echo -n "$PAYLOAD" | b64url_encode)
                                                                                                                                                                                                                 
                                                                                                                                                                                                                 # Gerar assinatura HMAC-SHA256
                                                                                                                                                                                                                 SIGNATURE=$(echo -n "${HEADER_B64}.${PAYLOAD_B64}" | \
                                                                                                                                                                                                                     openssl dgst -sha256 -hmac "$API_KEY" -binary | b64url_encode)
                                                                                                                                                                                                                     
                                                                                                                                                                                                                     # Token final
                                                                                                                                                                                                                     TOKEN="${HEADER_B64}.${PAYLOAD_B64}.${SIGNATURE}"
                                                                                                                                                                                                                     
                                                                                                                                                                                                                     # Output
                                                                                                                                                                                                                     echo "# ============================================="
                                                                                                                                                                                                                     echo "# Qdrant JWT Token"
                                                                                                                                                                                                                     echo "# ============================================="
                                                                                                                                                                                                                     echo "# Profile: $PROFILE"
                                                                                                                                                                                                                     echo "# Expira em: $(date -d "@$EXPIRY" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "$EXPIRY" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)"
                                                                                                                                                                                                                     echo "# Valido por: $EXPIRY_DAYS dias"
                                                                                                                                                                                                                     echo "# ============================================="
                                                                                                                                                                                                                     echo ""
                                                                                                                                                                                                                     echo "# Adicionar ao fazai.conf ou variavel de ambiente:"
                                                                                                                                                                                                                     echo "QDRANT_JWT_TOKEN_${PROFILE^^}=${TOKEN}"
                                                                                                                                                                                                                     echo ""
                                                                                                                                                                                                                     echo "# Usar em requisicoes HTTP:"
                                                                                                                                                                                                                     echo "# curl -H 'api-key: ${TOKEN}' http://qdrant:6333/collections"
                                                                                                                                                                                                                     echo ""
                                                                                                                                                                                                                     echo "# Ou como Bearer token:"
                                                                                                                                                                                                                     echo "# curl -H 'Authorization: Bearer ${TOKEN}' http://qdrant:6333/collections"
