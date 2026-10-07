# Garimpo Porto Alegre — versão local

Aplicação para consultar imóveis de Porto Alegre e salvar simulações de compra e revenda no seu computador.

## Início rápido no Windows

1. Instale o **Node.js 24 ou superior**. Confira com `node -v` no terminal. O SQLite integrado exige essa versão.
2. Extraia o ZIP inteiro para uma pasta, por exemplo `Documentos\garimpo-poa-local`.
3. Dê dois cliques em **INICIAR-WINDOWS.bat**. Na primeira execução ele instala as dependências pela internet.
4. Quando aparecer `Ready`, abra **http://localhost:3000** no navegador.
5. Mantenha o terminal aberto enquanto usa o sistema. Para encerrar, pressione **Ctrl+C**.

Também pode abrir o terminal dentro da pasta e executar:

```powershell
npm install
npm run dev
```

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd install` e `npm.cmd run dev`, ou o arquivo BAT.

Se a porta 3000 estiver ocupada, o modo de desenvolvimento pode escolher outra: use a URL mostrada no terminal. Para definir uma porta: `npm run dev -- --port 3001`.

## Versão compilada

```powershell
npm run build
npm start
```

Acesse http://localhost:3000. O servidor escuta somente no computador local, em 127.0.0.1.

## O que está pronto

- Base inicial: 213 imóveis CAIXA de Porto Alegre (lista de 06/10/2026), incluindo 170 apartamentos, e 4 apartamentos Zuk consultados em 07/10/2026.
- Filtros por bairro, endereço, tipo, preço, fonte e ROI de análises salvas.
- Ordenação por preço, desconto sobre avaliação ou ROI simulado.
- Simulação de compra, revenda, comissões, transferência, registro, reforma, débitos, jurídico, manutenção, prazo, reserva e tributos.
- Salvamento e recuperação das análises em SQLite local.
- Atualização manual da lista oficial CAIXA, com intervalo mínimo de uma hora. Se a fonte falhar, mantém a última lista disponível.

## Onde ficam os dados

O banco é criado automaticamente em **.local-data/garimpo.sqlite** dentro da pasta do projeto. As análises desta versão começam vazias; dados eventualmente salvos no site hospedado não são transferidos automaticamente.

Para backup, encerre o aplicativo e copie a pasta **.local-data** inteira. Não apague essa pasta ao atualizar o código. Não é necessário instalar PostgreSQL, Docker, Cloudflare ou serviços de nuvem.

Depois de instalar as dependências, você pode consultar a base inicial e salvar análises sem internet. Atualização da CAIXA e abertura dos anúncios originais exigem conexão.

O aplicativo não envia suas análises a um serviço externo. A atualização acessa a lista pública da CAIXA; links externos são abertos quando você clica. Não publique esta versão diretamente na internet: ela foi feita para uso individual local, sem autenticação.

## Como usar

1. Filtre os imóveis e clique em **Analisar imóvel**.
2. Informe o valor de revenda que você estima e todas as despesas previstas.
3. Confira anúncio e edital no link da fonte.
4. Clique em **Salvar análise**.
5. Veja **Minhas análises** ou ordene por **Maior ROI simulado**.

Custos e prazo iniciam como “Não informado”. Todos os valores precisam ser preenchidos para liberar lucro, ROI e salvamento. Digite zero somente após confirmar que não há aquele custo. Preenchimento completo não é verificação econômica. O valor de avaliação da CAIXA não é assumido como valor de revenda.

## Fórmulas

Capital investido = compra × (1 + comissão de compra / 100 + transferência / 100) + registro + reforma + débitos + jurídico + custo mensal × meses + reserva.

Despesas de venda = revenda × corretagem / 100 + tributos informados.

Lucro = revenda − despesas de venda − capital investido.

ROI = lucro / capital investido × 100.

Não calcula tributos, financiamento ou risco jurídico automaticamente. Inclua os custos aplicáveis à sua operação.

## Limites do MVP

Zuk é uma seleção fixa, não um coletor automático. Não há coleta BB ou de imobiliárias, comparáveis automáticos, mapa nem leitura de editais. Disponibilidade, ocupação, datas e débitos precisam ser conferidos nas fontes. Desconto é sobre a avaliação divulgada, não sobre um valor de mercado verificado.

## Estrutura

- `app/page.tsx`: interface.
- `app/api/properties`: listagem e análises.
- `app/api/refresh`: coletor CAIXA.
- `app/api/analysis`: validação e salvamento.
- `lib/properties.ts`: leitura do CSV e cálculos.
- `lib/db.ts`: SQLite local.
- `data/`: base inicial e CSV original.

React, Next.js, TypeScript e SQLite do Node.js. Sem chaves pagas.

## Fontes

CAIXA: https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_RS.csv

Zuk: https://www.portalzuk.com.br/leilao-de-imoveis/c/todos-imoveis/rs/regiao/porto-alegre

## Verificação desta entrega

Compilação Next.js concluída. Servidor local testado: 217 registros carregados, página renderizada, análise salva e recuperada do SQLite, valores inválidos rejeitados e POST de origem externa bloqueado. Os dados usados no teste não integram o ZIP.

## Atualização 1.1.0 — campos obrigatórios

Copie os arquivos desta versão por cima do projeto anterior, mantendo sua pasta `.local-data`. Rode `npm install` novamente para instalar também o ESLint. As análises antigas continuam no banco. Elas ficam fora do ranking até serem revisadas e salvas: zeros antigos voltam a “Não informado” no formulário, valores positivos são preservados, e o prazo deve ser informado novamente.

Arquivos alterados nesta atualização:
- `lib/scenario.ts` (novo): tipos, campos desconhecidos, validação e cálculo.
- `lib/properties.ts`: parser preservado e integração com o simulador.
- `app/page.tsx`: formulário, pendências e ranking somente de análises completas; paginação sem efeito que altera estado sincronicamente.
- `app/api/analysis/route.ts`: validação obrigatória no servidor, incluindo versão 2.
- `eslint.config.mjs` e `package.json`: lint e comandos de teste.
- `tests/scenario.test.mjs`: regressões de campos vazios, zeros explícitos, migração e cálculos.

Verificações:

```powershell
npm run lint
npm run check
npm test
npm run build
```

Não é necessário apagar o banco, reinstalar o Node ou publicar o projeto.
