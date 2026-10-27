# Sistema de Rotas e OCR — Guia rápido

Este sistema organiza rotas e lê folhas de frete em PDF. Siga os passos abaixo para abrir no computador.

## O que precisa

- Windows 64 bits
- Node.js em versão **ZIP/portátil**
- Python 3.12

**Atenção:** neste computador não podemos instalar o Node.js pelo instalador. Baixe no site oficial do Node.js a opção **Windows Binary (.zip)**, extraia a pasta e use o caminho dessa pasta nos comandos abaixo. Não precisa executar instalador nem ter permissão de administrador.

## Primeira configuração

Abra o PowerShell dentro da pasta do projeto. Primeiro, informe onde você extraiu o Node.js. Troque o caminho de exemplo pelo caminho real da pasta que contém `node.exe`:

```powershell
$env:Path = "C:\Ferramentas\node-vXX-win-x64;" + $env:Path
```

Confirme que o Node e o npm estão disponíveis:

```powershell
node -v
npm.cmd -v
```

Instale as dependências do sistema e os dois leitores OCR:

```powershell
npm.cmd install
py -3.12 -m pip install -r server/requirements-rapidocr.txt
py -3.12 -m pip install -r server/requirements-paddle.txt
Copy-Item .env.example .env
```

A instalação dos leitores e o primeiro carregamento dos modelos podem demorar. Os modelos OCR são baixados automaticamente quando usados pela primeira vez.

## Abrir o sistema

Sempre que abrir uma nova janela do PowerShell, configure novamente o caminho do Node ZIP:

```powershell
$env:Path = "C:\Ferramentas\node-vXX-win-x64;" + $env:Path
npm.cmd run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. Deixe a janela do PowerShell aberta enquanto usa o sistema. Para encerrar, volte à janela e pressione `Ctrl+C`.

Você só precisa executar `npm.cmd install` e instalar os pacotes Python na primeira configuração, ou quando houver uma atualização que peça isso. Para usar o sistema, basta configurar o caminho do Node ZIP e executar `npm.cmd run dev`.

## Importar e conferir um PDF

1. No sistema, abra **Importar documentos** e selecione PaddleOCR ou RapidOCR.
2. Escolha os PDFs e aguarde a leitura. PDFs grandes ou manuscritos podem levar alguns minutos.
3. Abra **Conferência e Revisão de OCR** para revisar cidades, códigos, veículos e valores.
4. Corrija os campos necessários e aprove os registros revisados.

Confira com atenção os valores manuscritos antes de aprovar. Para perfis CASA, revise frete peso e pedágio; para linhas de terceiros, revise o valor total.

## Usar em outro computador

Copie a pasta do projeto e faça a configuração inicial nesse computador também. Cada colega precisa ter Node.js ZIP, Python 3.12 e as dependências instaladas localmente. O caminho da pasta do Node ZIP pode ser diferente em cada computador.

Os dados desta versão ficam nos arquivos locais do computador onde o sistema está rodando. Para transferir os dados, copie também:

- `data/database.json` — cidades, rotas e configurações.
- `storage/uploads/` — PDFs importados.

Feche o sistema antes de copiar esses arquivos e mantenha uma cópia de segurança. Compartilhar uma cópia da pasta não sincroniza automaticamente os dados entre computadores.
