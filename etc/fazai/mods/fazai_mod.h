#ifndef FAZAI_MOD_H
#define FAZAI_MOD_H

#ifdef __cplusplus
extern "C" {
#endif

// Funções exportadas pelo módulo
int fazai_mod_init();
int fazai_mod_exec(const char* cmd, char* result, int result_len);
void fazai_mod_cleanup();

#ifdef __cplusplus
}
#endif

#endif // FAZAI_MOD_H