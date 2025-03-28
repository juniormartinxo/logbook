import { Injectable, Logger, BadRequestException, Inject, OnModuleInit } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { format, startOfDay, endOfDay, isBefore, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { endOfDayWithTimezone, formatBrazilianDate, startOfDayWithTimezone } from 'src/utils/date-utils'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

interface Commit {
    sha: string
    commit: {
        message: string
        author: {
            date: string
            name: string
        }
    }
}

interface Repository {
    name: string
    url: string
}

@Injectable()
export class CommitReportService implements OnModuleInit {
    // Cache dos resultados de verificação de repositório
    private repoExistsCache: Map<string, boolean> = new Map()
    // Cache de branches por repositório
    private repoBranchesCache: Map<string, any[]> = new Map()

    private readonly logger = new Logger(CommitReportService.name)
    private repositories: Repository[] = []

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    onModuleInit() {
        this.loadRepositoriesFromEnv()
    }

    private loadRepositoriesFromEnv() {
        try {
            // Tentar obter a lista de repositórios como JSON
            const reposJson = this.configService.get<string>('GITHUB_REPOSITORIES')
            if (reposJson) {
                try {
                    this.repositories = JSON.parse(reposJson)
                    this.logger.log(`Carregados ${this.repositories.length} repositórios do JSON de configuração`)
                    return
                } catch (e) {
                    this.logger.error(`Erro ao analisar JSON de repositórios: ${e.message}`)
                }
            }

            // Fallback: buscar repositórios individuais
            const repoUrls = this.configService.get<string>('GITHUB_REPOSITORY_URLS')?.split(',') || []
            const repoNames = this.configService.get<string>('GITHUB_REPOSITORY_NAMES')?.split(',') || []

            if (repoUrls.length === 0) {
                this.logger.warn('Nenhum repositório configurado. Configure as variáveis GITHUB_REPOSITORIES ou GITHUB_REPOSITORY_URLS e GITHUB_REPOSITORY_NAMES')
                return
            }

            if (repoUrls.length !== repoNames.length) {
                this.logger.warn('Número de URLs e nomes de repositórios não correspondem. Verifique as variáveis GITHUB_REPOSITORY_URLS e GITHUB_REPOSITORY_NAMES')
                return
            }

            this.repositories = repoUrls.map((url, index) => ({
                name: repoNames[index].trim(),
                url: url.trim(),
            }))

            this.logger.log(`Carregados ${this.repositories.length} repositórios da configuração`)
        } catch (error) {
            this.logger.error(`Erro ao carregar repositórios: ${error.message}`)
        }
    }

    private validateDates(startDate: Date, endDate: Date) {
        if (isBefore(endDate, startDate)) {
            throw new BadRequestException('A data inicial não pode ser maior que a data final')
        }
    }

    private formatDate(date: Date): string {
        return formatBrazilianDate(date)
    }

    private async checkRepositoryExists(repo: Repository): Promise<boolean> {
        // Verificar se já temos o resultado em cache
        const cacheKey = repo.url
        if (this.repoExistsCache.has(cacheKey)) {
            return this.repoExistsCache.get(cacheKey) ?? false
        }

        try {
            const apiUrl = `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}`
            this.logger.debug(`Verificando existência do repositório ${repo.name} em ${apiUrl}`)

            const response = await firstValueFrom(
                this.httpService.get(apiUrl, {
                    headers: {
                        Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }),
            )

            this.logger.debug(`Repositório ${repo.name} encontrado: ${response.data.name}`)

            // Armazenar resultado em cache
            this.repoExistsCache.set(cacheKey, true)
            return true
        } catch (error) {
            if (error.response?.status === 404) {
                this.logger.error(`Repositório ${repo.name} não encontrado`)
                // Armazenar resultado em cache
                this.repoExistsCache.set(cacheKey, false)
                return false
            }
            this.logger.error(`Erro ao verificar repositório ${repo.name}:`, error.response?.data || error.message)
            throw error
        }
    }

    private async checkRepositoryHasCommits(repo: Repository): Promise<boolean> {
        try {
            const apiUrl = `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/commits`
            this.logger.debug(`Verificando commits do repositório ${repo.name} em ${apiUrl}`)

            const response = await firstValueFrom(
                this.httpService.get(apiUrl, {
                    params: {
                        per_page: 1,
                    },
                    headers: {
                        Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }),
            )

            const hasCommits = response.data.length > 0
            this.logger.debug(`Repositório ${repo.name} ${hasCommits ? 'possui' : 'não possui'} commits`)
            return hasCommits
        } catch (error) {
            this.logger.error(`Erro ao verificar commits do repositório ${repo.name}:`, error.response?.data || error.message)
            this.logger.error(`Status code: ${error.response?.status}`)
            return false
        }
    }

    private async fetchLatestCommits(repo: Repository, limit: number = 5): Promise<Commit[]> {
        try {
            const apiUrl = `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/commits`
            this.logger.debug(`Buscando últimos ${limit} commits do repositório ${repo.name}`)

            // Primeiro, vamos buscar todas as branches
            const branchesResponse = await firstValueFrom(
                this.httpService.get(
                    `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/branches`,
                    {
                        headers: {
                            Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    },
                ),
            )

            const branches = branchesResponse.data
            this.logger.debug(`Encontradas ${branches.length} branches no repositório ${repo.name}`)

            // Para cada branch, buscamos os commits mais recentes
            const allCommits: Commit[] = []
            for (const branch of branches) {
                this.logger.debug(`Buscando commits recentes na branch ${branch.name}`)

                const response = await firstValueFrom(
                    this.httpService.get(apiUrl, {
                        params: {
                            per_page: limit,
                            sha: branch.name,
                        },
                        headers: {
                            Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    }),
                )

                allCommits.push(...response.data)
            }

            // Ordena por data e pega os mais recentes
            const sortedCommits = allCommits.sort((a, b) => {
                return new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
            }).slice(0, limit)

            this.logger.debug(`Encontrados ${sortedCommits.length} commits recentes para ${repo.name}`)

            if (sortedCommits.length > 0) {
                sortedCommits.forEach((commit: Commit) => {
                    this.logger.debug(`Commit em ${new Date(commit.commit.author.date).toLocaleString('pt-BR')}: ${commit.commit.message}`)
                })
            }

            return sortedCommits
        } catch (error) {
            this.logger.error(`Erro ao buscar commits recentes do repositório ${repo.name}:`, error.response?.data || error.message)
            throw error
        }
    }

    // Método para buscar branches com cache
    private async getRepoBranches(repo: Repository): Promise<any[]> {
        // Verificar se já temos as branches em cache
        const cacheKey = repo.url
        if (this.repoBranchesCache.has(cacheKey)) {
            const cachedBranches = this.repoBranchesCache.get(cacheKey)
            if (cachedBranches) {
                return cachedBranches
            }
        }

        try {
            const branchesResponse = await firstValueFrom(
                this.httpService.get(
                    `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/branches`,
                    {
                        headers: {
                            Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    },
                ),
            )

            const branches = branchesResponse.data
            this.logger.debug(`Encontradas ${branches.length} branches no repositório ${repo.name}`)

            // Armazenar em cache
            this.repoBranchesCache.set(cacheKey, branches)
            return branches
        } catch (error) {
            this.logger.error(`Erro ao buscar branches do repositório ${repo.name}:`, error.response?.data || error.message)
            throw error
        }
    }

    private async fetchAllCommits(
        repo: Repository,
        startDate: Date,
        endDate: Date,
    ): Promise<Commit[]> {
        const apiUrl = `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/commits`
        const allCommits: Commit[] = []
        let page = 1
        let hasMorePages = true

        // Usar os utilitários com timezone
        const startDateCopy = startOfDayWithTimezone(startDate)
        const endDateCopy = endOfDayWithTimezone(endDate)

        // Convertendo para ISO string para a API do GitHub
        const startDateISO = startDateCopy.toISOString()
        const endDateISO = endDateCopy.toISOString()

        this.logger.debug(`Buscando commits de ${repo.name} entre ${startDateISO} e ${endDateISO}`)

        // Primeiro, vamos buscar todas as branches
        try {
            const branchesResponse = await firstValueFrom(
                this.httpService.get(
                    `https://api.github.com/repos/${repo.url.split('/').slice(-2).join('/')}/branches`,
                    {
                        headers: {
                            Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    },
                ),
            )

            const branches = await this.getRepoBranches(repo)

            this.logger.debug(`Encontradas ${branches.length} branches no repositório ${repo.name}`)

            // Para cada branch, buscamos os commits
            for (const branch of branches) {
                this.logger.debug(`Buscando commits na branch ${branch.name}`)
                page = 1
                hasMorePages = true

                while (hasMorePages) {
                    this.logger.debug(`Buscando commits de ${repo.name} na branch ${branch.name} - Página ${page}`)

                    try {
                        const response = await firstValueFrom(
                            this.httpService.get(apiUrl, {
                                params: {
                                    since: startDateISO,
                                    until: endDateISO,
                                    per_page: 100,
                                    page,
                                    sha: branch.name,
                                },
                                headers: {
                                    Authorization: `token ${this.configService.get('GITHUB_TOKEN')}`,
                                    Accept: 'application/vnd.github.v3+json',
                                },
                            }),
                        )

                        const commits = response.data
                        this.logger.debug(`Encontrados ${commits.length} commits na branch ${branch.name} - Página ${page}`)

                        if (commits.length === 0) {
                            hasMorePages = false
                            continue
                        }

                        allCommits.push(...commits)

                        // Verifica se há mais páginas
                        const linkHeader = response.headers.link
                        if (!linkHeader || !linkHeader.includes('rel="next"')) {
                            hasMorePages = false
                        } else {
                            page++
                        }
                    } catch (error) {
                        this.logger.error(`Erro na requisição para ${repo.name} na branch ${branch.name} - Página ${page}:`, error.response?.data || error.message)
                        this.logger.error(`Status code: ${error.response?.status}`)
                        throw error
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Erro ao buscar branches do repositório ${repo.name}:`, error.response?.data || error.message)
            throw error
        }

        this.logger.debug(`Total de commits encontrados para ${repo.name}: ${allCommits.length}`)
        return allCommits
    }

    async generateReport(startDate: Date, endDate: Date, customRepositories?: Repository[]): Promise<string[]> {
        this.validateDates(startDate, endDate)

        // Usar repositórios personalizados ou os configurados
        const repositories = customRepositories || this.repositories

        // Se não houver repositórios, retornar mensagem de erro
        if (repositories.length === 0) {
            return ['Nenhum repositório configurado para análise.']
        }

        // Criar uma chave de cache baseada nos parâmetros
        const repoKey = customRepositories
            ? JSON.stringify(customRepositories.map(r => r.url).sort())
            : 'default'
        const cacheKey = `report:${repoKey}:${startDate.toISOString()}:${endDate.toISOString()}`

        // Verificar se os resultados estão em cache
        const cachedResult = await this.cacheManager.get<string[]>(cacheKey)
        if (cachedResult && !customRepositories) { // Não usar cache para repositórios personalizados
            this.logger.debug(`Retornando resultado em cache para ${cacheKey}`)
            return cachedResult
        }

        // Se não estiver em cache, gerar o relatório
        const reports: string[] = []

        for (const repo of repositories) {
            try {
                this.logger.debug(`\nProcessando repositório: ${repo.name}`)

                const exists = await this.checkRepositoryExists(repo)
                if (!exists) {
                    reports.push(`Repositório ${repo.name} não encontrado ou inacessível`)
                    continue
                }

                const hasCommits = await this.checkRepositoryHasCommits(repo)
                if (!hasCommits) {
                    reports.push(`Repositório ${repo.name} não possui commits`)
                    continue
                }

                // Busca os últimos commits para diagnóstico
                await this.fetchLatestCommits(repo)

                const commits = await this.fetchAllCommits(repo, startDate, endDate)
                const report = await this.generateRepositoryReport(repo, commits)
                reports.push(report)
            } catch (error) {
                this.logger.error(`Erro ao processar repositório ${repo.name}:`, error)
                reports.push(`Erro ao processar repositório ${repo.name}: ${error.message}`)
            }
        }

        // Armazenar os resultados em cache antes de retornar (apenas para repositórios padrão)
        if (!customRepositories) {
            await this.cacheManager.set(cacheKey, reports)
        }

        return reports
    }

    async getRawCommits(startDate: Date, endDate: Date, customRepositories?: Repository[]): Promise<string> {
        this.validateDates(startDate, endDate)

        // Usar repositórios personalizados ou os configurados
        const repositories = customRepositories || this.repositories

        // Se não houver repositórios, retornar mensagem de erro
        if (repositories.length === 0) {
            return '# Erro\n\nNenhum repositório configurado para análise.'
        }

        const repoKey = customRepositories
            ? JSON.stringify(customRepositories.map(r => r.url).sort())
            : 'default'
        const cacheKey = `raw-commits:${repoKey}:${startDate.toISOString()}:${endDate.toISOString()}`

        // Não usar cache para repositórios personalizados
        const cachedResult = !customRepositories ? await this.cacheManager.get<string>(cacheKey) : null

        if (cachedResult) {
            this.logger.debug(`Retornando raw-commits em cache para ${cacheKey}`)
            return cachedResult
        }

        let markdown = '# Relatório de Commits\n\n'

        this.logger.debug(`Iniciando geração do relatório para o período de ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`)

        // Ajustando as datas para considerar o fuso horário
        const startDateCopy = startOfDay(startDate)
        const endDateCopy = endOfDay(endDate)

        for (const repo of repositories) {
            try {
                this.logger.debug(`\nProcessando repositório: ${repo.name}`)

                const exists = await this.checkRepositoryExists(repo)
                if (!exists) {
                    markdown += `## ${repo.name}\n\n`
                    markdown += `Repositório não encontrado ou inacessível\n\n`
                    continue
                }

                const hasCommits = await this.checkRepositoryHasCommits(repo)
                if (!hasCommits) {
                    markdown += `## ${repo.name}\n\n`
                    markdown += `Repositório não possui commits\n\n`
                    continue
                }

                // Busca os últimos commits para diagnóstico
                const latestCommits = await this.fetchLatestCommits(repo)
                if (latestCommits.length > 0) {
                    const latestCommit = latestCommits[0]
                    const latestDate = parseISO(latestCommit.commit.author.date)
                    this.logger.debug(`Último commit em ${format(latestDate, 'dd/MM/yyyy, HH:mm:ss', { locale: ptBR })}`)

                    // Se o último commit for anterior ao período solicitado, adiciona uma mensagem
                    if (isBefore(latestDate, startDateCopy)) {
                        markdown += `## ${repo.name}\n\n`
                        markdown += `Período solicitado: ${this.formatDate(startDateCopy)} até ${this.formatDate(endDateCopy)}\n\n`
                        markdown += `Último commit: ${this.formatDate(latestDate)}\n\n`
                        markdown += `Não há commits no período solicitado. O último commit foi realizado em ${this.formatDate(latestDate)}.\n\n`
                        continue
                    }
                }

                const commits = await this.fetchAllCommits(repo, startDateCopy, endDateCopy)
                markdown += `## ${repo.name}\n\n`
                markdown += `Período: ${this.formatDate(startDateCopy)} até ${this.formatDate(endDateCopy)}\n\n`
                markdown += `Total de commits: ${commits.length}\n\n`

                if (commits.length === 0) {
                    markdown += 'Nenhum commit encontrado neste período.\n\n'
                    continue
                }

                markdown += '### Commits\n\n'
                commits.forEach((commit) => {
                    const date = format(parseISO(commit.commit.author.date), 'dd/MM/yyyy, HH:mm:ss', { locale: ptBR })
                    markdown += `#### ${date}\n\n`
                    markdown += `**Autor:** ${commit.commit.author.name}\n\n`
                    markdown += `**Mensagem:**\n${commit.commit.message}\n\n`
                    markdown += `**Hash:** \`${commit.sha}\`\n\n`
                    markdown += '---\n\n'
                })

                markdown += '\n'
            } catch (error) {
                this.logger.error(`Erro ao buscar commits do repositório ${repo.name}:`, error)
                markdown += `## ${repo.name}\n\n`
                markdown += `Erro ao buscar commits: ${error.message}\n\n`
            }
        }

        // Armazenar em cache apenas para repositórios padrão
        if (!customRepositories) {
            await this.cacheManager.set(cacheKey, markdown)
        }

        return markdown
    }

    async generateSummary(startDate: Date, endDate: Date, customRepositories?: Repository[]): Promise<string> {
        this.validateDates(startDate, endDate)
        const reports = await this.generateReport(startDate, endDate, customRepositories)

        const prompt = `Analise os seguintes relatórios de commits e crie um resumo executivo em markdown que destaque as principais mudanças e melhorias realizadas em cada repositório:

${reports.join('\n\n')}

Por favor, forneça um resumo em português que:
1. Explique as principais mudanças de forma não técnica
2. Destaque os benefícios para o negócio
3. Use linguagem clara e acessível
4. Mantenha o foco nos resultados e impactos positivos
5. Organize o conteúdo em seções com títulos em markdown
6. Use listas e destaques para melhor legibilidade`

        return this.callDeepSeek(prompt)
    }

    private async generateRepositoryReport(
        repo: Repository,
        commits: Commit[],
    ): Promise<string> {
        const prompt = this.buildPrompt(repo, commits)
        const report = await this.callDeepSeek(prompt)
        return report
    }

    private buildPrompt(repo: Repository, commits: Commit[]): string {
        const commitMessages = commits
            .map((commit) => commit.commit.message)
            .join('\n')

        return `Analise os seguintes commits do repositório ${repo.name} e crie um relatório claro e conciso para gestores não técnicos, explicando as principais mudanças e melhorias realizadas:

Commits:
${commitMessages}

Por favor, forneça um resumo em português que:
1. Explique as principais mudanças de forma não técnica
2. Destaque os benefícios para o negócio
3. Use linguagem clara e acessível
4. Mantenha o foco nos resultados e impactos positivos`
    }

    private async callDeepSeek(prompt: string): Promise<string> {
        const deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY')
        const response = await firstValueFrom(
            this.httpService.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                },
                {
                    headers: {
                        Authorization: `Bearer ${deepseekApiKey}`,
                        'Content-Type': 'application/json',
                    },
                },
            ),
        )

        return response.data.choices[0].message.content
    }
} 