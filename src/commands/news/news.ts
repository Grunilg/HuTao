import { Message, MessageEmbed } from "discord.js"

import Command from "../../utils/Command"
import client from "../../main"
import { Colors, findFuzzy, getNewsEmbed, parseNewsContent, sendMessage, simplePaginator } from "../../utils/Utils"
import config from "../../data/config.json"
import { NewsLang } from "../../utils/Types"

export default class News extends Command {
    constructor(name: string) {
        super({
            name,
            category: "News",
            usage: "news [language] [id]",
            help: `Check up on latest news. You can follow the English ones with \`${config.prefix}follow add news_en-us\` (see \`${config.prefix}help follow\` for the others)
Supported languages: ${client.newsManager.getLanguages().map(l => `\`${l}\``).join(", ")}`,
            aliases: ["new", "n"]
        })
    }

    async run(message: Message, args: string[]): Promise<Message | Message[] | undefined> {
        const { newsManager } = client

        let idMatch = args[0], langMatch = "en-us"
        if (args[0]?.match(/^\d+/)) {
            idMatch = args[0]
            langMatch = args[1]
        } else {
            idMatch = args[1]
            langMatch = args[0]
        }

        const lang = this.getFuzzyLang(langMatch)

        if (!idMatch) {
            const stored = newsManager
                .getNews(lang)
                .map(art => `[\`${art.post_id}\`](${art.lang == "bbs-zh-cn" ? `https://bbs.mihoyo.com/ys/article/${art.post_id}` : `https://www.hoyolab.com/article/${art.post_id}`}): ${art.subject}`)

            while (stored.join("\n").length > 1500) stored.pop()

            const embed = new MessageEmbed()
                .setColor(Colors.GREEN)
                .setTitle(`Most recent ${newsManager.getLanguageName(lang)} news articles:`)
                .setFooter(`You can use open the links or use \`${config.prefix}news <post id>\` to view more details about a post`)
                .setDescription(stored.join("\n"))

            return sendMessage(message, embed)
        }

        const post = newsManager.getNewsByIdLang(idMatch, lang)
        if (!post)
            return sendMessage(message, `Couldn't find article in cache. Try to see if it exists on the forum: <https://www.hoyolab.com/article/${args[0]}>`)

        await simplePaginator(message, (relativePage, currentPage, maxPages) => getNewsEmbed(post, relativePage, currentPage, maxPages), parseNewsContent(post.content).length)

        return undefined
    }

    getFuzzyLang(search: string): NewsLang {
        const { newsManager } = client

        let lang = findFuzzy([
            ...newsManager.getLanguages(),
            ...newsManager.getLanguages().map(l => newsManager.getLanguageName(l))
        ], search ?? "en-us") ?? "en-us"

        for (const l of newsManager.getLanguages())
            if (lang == newsManager.getLanguageName(l)) {
                lang = l
                break
            }

        return lang as NewsLang
    }
}
