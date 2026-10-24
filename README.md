# Monfredini Transportes — Guia Rápido

## Primeira instalação

Instale Node.js e Python 3.12. Abra o PowerShell na pasta do projeto e rode:

```powershell
npm.cmd install
py -3.12 -m pip install -r server/requirements-rapidocr.txt
py -3.12 -m pip install -r server/requirements-paddle.txt
Copy-Item .env.example .env
```

Os dois OCRs são gratuitos e locais. Instale ambos se quiser alternar entre eles.

## Iniciar o sistema

Se o Node estiver nessa pasta portátil, rode este comando em cada nova janela do PowerShell:

```powershell
$env:Path = "C:\Users\ruan.dias\Downloads\node-v24.22.1-win-x64\node-v24.22.1-win-x64;" + $env:Path
```

Depois, inicie o sistema:

```powershell
npm.cmd run dev
```

Abra [http://localhost:3000](http://localhost:3000). Para parar o servidor, pressione `Ctrl+C` no PowerShell.

**Não precisa reinstalar o `archiver` nem rodar `npm install` toda vez.** As dependências são instaladas na primeira configuração. O comando do Node acima só precisa ser repetido se abrir uma nova janela do PowerShell e o Node não estiver no `Path` permanente do Windows.

## Ler folhas de frete

1. Abra **Importar documentos** e selecione **RapidOCR** ou **PaddleOCR**.
2. Envie os PDFs e aguarde o processamento.
3. Abra **Conferência e Revisão de OCR** e confira cidades, siglas, veículos e valores.
4. Corrija o que for necessário e aprove os registros revisados.

Para perfis CASA, confira frete peso e pedágio. Para terceiros, confira o valor total da linha.

## Usar em outro computador

Instale Node.js e Python 3.12, copie a pasta do projeto e repita os comandos de **Primeira instalação**. Ajuste o caminho do Node no comando acima para a pasta daquele computador.

Para levar seus dados, copie também:

- `data/database.json` — cidades, rotas e configurações.
- `storage/uploads/` — PDFs importados.

Faça uma cópia de segurança antes de transferir. Os modelos OCR podem ser baixados na primeira leitura.
