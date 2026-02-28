# Qdrant HA Cluster - Documentacao

## Visao Geral

Este documento descreve a arquitetura de alta disponibilidade (HA) do Qdrant
implementada para o projeto FazAI, com replicacao assincrona entre dois nos:

- **Walker (Master)**: No principal, aceita leituras e escritas (RW)
- - **Papaimach (Replica)**: No secundario, RO nas collections replicadas, RW nas locais
 
  - ## Arquitetura
 
  - ```
    +-------------------+                  +---------------------+
    |   WALKER:6333     |   Replicacao     |   PAPAIMACH:6363    |
    |   (Master RW)     |   Assincrona     |   (Replica)         |
    +-------------------+  ------------->  +---------------------+
    | fazai_learning    |                  | fazai_learning (RO) |
    | fazai_memory      |                  | fazai_memory (RO)   |
    | fazai_inference   |                  | fazai_inference(RO) |
    | fazai_kb          |                  | fazai_kb (RO)       |
    | fazai_*           |                  | fazai_* (RO)        |
    | source            |                  | source (RO)         |
    | terraforming      |                  | terraforming (RO)   |
    +-------------------+                  +---------------------+
                                           | claudio_soul (RW)   |
                                           | claudio_sources(RW) |
                                           +---------------------+

    Dimensao vetores: 768 (BGE-base-en-v1.5 via qdrant-universal-injection — Lei 768)
    Metrica: Cosine
    ```

    ## Controle de Acesso (JWT RBAC)

    O acesso eh controlado via JWT tokens com permissoes granulares por collection.

    ### Profiles de Acesso

    | Profile  | Descricao                                   | Uso                    |
    |----------|---------------------------------------------|------------------------|
    | master   | Acesso total (manage)                       | Walker localhost       |
    | claudio  | RO replicadas + RW claudio_*                | Papaimach desktop/cli  |
    | readonly | Somente leitura global                      | Monitoramento          |
    | fazai    | RW somente em fazai_*                       | Aplicacao FazAI        |

    ### Gerando Tokens

    ```bash
    # Gerar token para Claudio (papaimach)
    QDRANT_API_KEY=sua_chave ./scripts/qdrant/generate-jwt.sh claudio 365

    # Gerar token somente leitura
    QDRANT_API_KEY=sua_chave ./scripts/qdrant/generate-jwt.sh readonly 30
    ```

    ## Arquivos de Configuracao

    | Arquivo                              | Descricao                     |
    |--------------------------------------|-------------------------------|
    | docker/qdrant/config-walker.yaml     | Config do master (walker)     |
    | docker/qdrant/config-papaimach.yaml  | Config da replica (papaimach) |
    | scripts/qdrant/setup-cluster.sh      | Script de setup do cluster    |
    | scripts/qdrant/generate-jwt.sh       | Gerador de tokens JWT         |

    ## Variaveis de Ambiente

    ```bash
    # Obrigatorio - API key para JWT RBAC
    QDRANT_API_KEY=sua_chave_secreta_aqui

    # Opcional - hosts (default: walker/papaimach)
    WALKER_HOST=walker
    WALKER_PORT=6333
    PAPAIMACH_HOST=papaimach
    PAPAIMACH_PORT=6363
    ```

    ## Configuracao no fazai.conf

    Adicionar ao `/etc/fazai/fazai.conf`:

    ```bash
    # =============================================================================
    # QDRANT VECTOR DATABASE - HA CLUSTER
    # =============================================================================
    VECTOR_PROVIDER=qdrant
    VECTOR_DIMENSION=768
    VECTOR_DISTANCE=cosine

    # URL local (walker master)
    QDRANT_URL=http://localhost:6333

    # API Key para JWT RBAC
    QDRANT_API_KEY=sua_chave_secreta_aqui

    # Collections replicadas
    QDRANT_REPLICATE_COLLECTIONS=fazai_learning,fazai_memory,fazai_inference,fazai_kb
    ```

    ## Passos de Instalacao

    ### 1. Gerar API Key

    Acesse o dashboard do Qdrant e gere uma API key:
    - Walker: http://walker:6333/dashboard#/jwt
    - - Papaimach: http://papaimach:6363/dashboard#/jwt
     
      - ### 2. Configurar Cluster
     
      - ```bash
        # Verificar estado atual
        ./scripts/qdrant/setup-cluster.sh check

        # Ver comandos de setup (nao aplica automaticamente)
        ./scripts/qdrant/setup-cluster.sh setup
        ```

        ### 3. Iniciar Walker (Master)

        ```bash
        docker run -d \
          --name qdrant-walker \
          -p 6333:6333 -p 6334:6334 -p 6335:6335 \
          -v qdrant-walker-data:/qdrant/storage \
          -v ./docker/qdrant/config-walker.yaml:/qdrant/config/production.yaml \
          -e QDRANT_API_KEY=${QDRANT_API_KEY} \
          qdrant/qdrant \
          --uri 'http://walker:6335'
        ```

        ### 4. Iniciar Papaimach (Replica)

        ```bash
        docker run -d \
          --name qdrant-papaimach \
          -p 6363:6333 -p 6364:6334 -p 6365:6335 \
          -v qdrant-papaimach-data:/qdrant/storage \
          -v ./docker/qdrant/config-papaimach.yaml:/qdrant/config/production.yaml \
          -e QDRANT_API_KEY=${QDRANT_API_KEY} \
          qdrant/qdrant \
          --bootstrap 'http://walker:6335' \
          --uri 'http://papaimach:6365'
        ```

        ### 5. Replicar Collections

        ```bash
        # Ver comandos de replicacao
        ./scripts/qdrant/setup-cluster.sh replicate
        ```

        ### 6. Gerar JWT Tokens

        ```bash
        # Token para Claudio (papaimach)
        ./scripts/qdrant/generate-jwt.sh claudio 365
        ```

        ## Migracao de Dimensao (1536 -> 768)

        As collections atuais usam dimensao 1536. Para migrar para 768:

        1. Exportar dados via scroll API
        2. 2. Reprocessar embeddings com BGE-base-en-v1.5 via qdrant-universal-injection (768d ONNX)
           3. 3. Criar novas collections com dimensao 768
              4. 4. Importar dados reprocessados
                
                 5. Este processo sera documentado separadamente.
                
                 6. ## Troubleshooting
                
                 7. ### Cluster nao conecta
                
                 8. ```bash
                    # Verificar conectividade P2P
                    curl http://walker:6335/health
                    curl http://papaimach:6365/health

                    # Verificar status do cluster
                    ./scripts/qdrant/setup-cluster.sh status
                    ```

                    ### Token JWT invalido

                    ```bash
                    # Verificar que a mesma API_KEY eh usada em ambos os nos
                    # Verificar expiracao do token (campo "exp" no payload)
                    ```

                    ### Replicacao falha

                    ```bash
                    # Verificar peer_ids
                    curl http://walker:6333/cluster | jq '.result.peer_id'
                    curl http://papaimach:6363/cluster | jq '.result.peer_id'
                    ```

                    ## Referencias

                    - [Qdrant Distributed Deployment](https://qdrant.tech/documentation/guides/distributed_deployment/)
                    - - [Qdrant Security - JWT RBAC](https://qdrant.tech/documentation/guides/security/)
                      - - [Qdrant Snapshots](https://qdrant.tech/documentation/concepts/snapshots/)
