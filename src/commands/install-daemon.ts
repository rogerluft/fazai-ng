import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { execSync } from 'child_process';
import chalk from 'chalk';

export async function handleInstallDaemonCommand(args: string[]) {
  logger.info('Instalando o Fazai Daemon como um serviço do systemd...');

  // Caminho do executável global do fazai (se instalado via npm install -g fazai)
  // ou fallback para o binário atual executando
  const execPath = process.execPath;
  let fazaiBin = '';
  try {
    fazaiBin = execSync('which fazai', { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    fazaiBin = process.argv[1];
  }

  if (!fazaiBin) {
    fazaiBin = path.join(process.cwd(), 'bin', 'fazai.js');
  }

  const serviceName = 'fazai-daemon.service';
  const servicePath = `/etc/systemd/system/${serviceName}`;
  const user = process.env.SUDO_USER || process.env.USER || 'root';

  const serviceContent = `[Unit]
Description=Fazai AI Assistant Daemon
After=network.target

[Service]
Type=simple
User=${user}
ExecStart=${fazaiBin} daemon
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=fazai-daemon

# Environments variables can be loaded from config or set here if needed
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

  try {
    if (process.getuid && process.getuid() !== 0) {
      logger.error('Você precisa de privilégios de root para instalar o daemon. Tente rodar: sudo fazai install-daemon');
      process.exit(1);
    }

    fs.writeFileSync(servicePath, serviceContent, 'utf-8');
    logger.info(`✅ Arquivo de serviço criado em: ${servicePath}`);

    logger.info('Recarregando o systemd daemon...');
    execSync('systemctl daemon-reload');

    logger.info('Habilitando o serviço para iniciar no boot...');
    execSync(`systemctl enable ${serviceName}`);

    logger.info('Iniciando o serviço...');
    execSync(`systemctl start ${serviceName}`);

    logger.info(chalk.green(`\n🎉 Fazai Daemon instalado e rodando com sucesso!`));
    logger.info(`Para checar o status, use: ${chalk.cyan('systemctl status fazai-daemon')}`);
    logger.info(`Para ver os logs, use: ${chalk.cyan('journalctl -u fazai-daemon -f')}`);

  } catch (error: any) {
    logger.error(`❌ Falha ao instalar o daemon: ${error.message}`);
    process.exit(1);
  }
}
