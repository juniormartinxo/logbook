# Logbook

Serviço para geração de relatórios de commits de repositórios Git.

## Configuração

1. Clone o repositório
2. Instale as dependências:
```bash
pnpm install
```

3. Configure as variáveis de ambiente:
- Crie um arquivo `.env` na raiz do projeto
- Adicione as seguintes variáveis:
  ```
  PORT=3001
  GITHUB_TOKEN=seu_token_do_github_aqui
  DEEPSEEK_API_KEY=sua_chave_api_do_deepseek_aqui
  REDIS_PASSWORD=sua_senha_redis_aqui
  
  # Configuração dos repositórios padrão (formato JSON)
  GITHUB_REPOSITORIES='[{"name":"repo1","url":"https://github.com/usuario/repo1"},{"name":"repo2","url":"https://github.com/usuario/repo2"}]'
  
  # OU use as variáveis separadas (alternativa)
  # GITHUB_REPOSITORY_NAMES=repo1,repo2,repo3
  # GITHUB_REPOSITORY_URLS=https://github.com/usuario/repo1,https://github.com/usuario/repo2,https://github.com/usuario/repo3
  ```

## Uso

### Geração de relatórios síncronos

Para gerar um relatório de commits, faça uma requisição GET para `/commit-report` com um corpo JSON contendo:

```json
{
  "startDate": "2024-03-01",
  "endDate": "2024-03-28",
  "repositories": [
    {
      "name": "meu-repo",
      "url": "https://github.com/usuario/meu-repo"
    },
    {
      "name": "outro-repo",
      "url": "https://github.com/usuario/outro-repo"
    }
  ]
}
```

O campo `repositories` é opcional. Se não for fornecido, os repositórios configurados no arquivo `.env` serão utilizados.

Endpoints disponíveis:

- `GET /commit-report` - Gera um relatório detalhado para cada repositório
- `GET /commit-report/raw` - Gera um relatório bruto contendo todos os commits
- `GET /commit-report/summary` - Gera um resumo executivo dos commits em formato markdown

### Geração de relatórios assíncronos

Para processamento assíncrono de relatórios (recomendado para períodos longos), use:

```bash
POST /async-reports
```

Corpo:
```json
{
  "startDate": "2024-03-01",
  "endDate": "2024-03-28",
  "repositories": [
    {
      "name": "meu-repo",
      "url": "https://github.com/usuario/meu-repo"
    }
  ]
}
```

Isso retornará um ID de relatório que pode ser consultado posteriormente:

```bash
GET /async-reports/{reportId}
```

Para listar todos os relatórios assíncronos:

```bash
GET /async-reports?page=1&limit=20
```

## Monitoramento de Filas

Um dashboard para monitoramento das filas de processamento está disponível em:

```
/admin/queues
```

## Tecnologias

- NestJS
- Bull (para processamento de filas)
- Redis (para cache e filas)
- DeepSeek (para análise e sumarização de commits)
- GitHub API (para consulta de repositórios)