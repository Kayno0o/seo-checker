import { Command } from 'commander'
import { generateSitemap } from './utils/generateSitemap'

const cli = new Command()

cli
  .command('generate')
  .argument('<url>', 'URL of the website')
  .option<number>('-m, --max <number>', 'Max concurrent requests', (max: string) => Number.parseInt(max), 15)
  .option('-o, --output <string>', 'Path of output sitemap.xml file', 'sitemap.xml')
  .action(async (url: string, options: { max: number, output: string }) => {
    await generateSitemap(url, { ...options, log: true })
  })

cli.parse()
