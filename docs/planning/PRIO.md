1 - Logica de modelos: definir ordem no /etc/fazai/fazai.conf (seria interessante ter um ou 2 modelos locais pequenos para como tinyllama e ou outro maiorzinho e trabalhar bastante na engenharia de prompts e na utilzaçao do cache. É incrivel como pequenos modelos podem fazer coisas incriveis com prompts bem estruturados, pelo menos para executar ordens em linguagem natural, que se utilizem apenas de logica de bash, fs e linux. Ja corrige o problema 3.2, 5 - falta de interface para providers nesse topicos. E o ITEM 4 - tratamento de erro para perplexity tambem associado. E resolvemos o ITEM 6 tambem vamos tirar esses apelidos, vai serguir a ordem do conf ou o nome do modelo correto.

1.5 - analizar semanticas em nlp ao rodar ex: fazai "instrucao bla bla, bla bla" a virgula causa problemas

2 - remover suporte a local sem  ~/.config/fazai/fazai.conf fica tudo no /etc/.....  Motivo nao tem flexibilidade, cachorro com 2 donos morre de fome. alem disso eh mais uma coisa para dar problemas...
 executar o plano:
 2. Se remover:
    - Atualizar src/config.ts para ler apenas /etc/fazai/fazai.conf
    - Atualizar documentação (README, MANUAL, AGENTS.md)
    - Adicionar migração no installer

3. melhorar o log de interacao entre as collections, bem como a injecao da personalidade, que eh diferente do conhecimento, e do aprendizado. usar os agentes para trabalhar de forma a projetar um fluxo neural de autoaprendizado e com personalidade solida alem de memorias para que possa ser ensinado. Integrar p cacheGPT ou algo semelhante para otimizar em mais uma camada.

4..... demais correcoes funcionais... E TESTES SIMULANDO USO DO USUARIO.

5 .... melhorias funcionais.... LOGGSSS

6... performance

7 . Trabalhar no problema 8 validar a config... mas acho que isso depois de homologarmos as features

8. perfumaria e outros...


#############TODAS ALTERACOES DEVEM REFLETIR NO INSTALADOR, NO CHANGELOG, O CODIGO DEVE SER BEM COMENTADO###########
