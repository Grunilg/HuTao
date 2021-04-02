import { Message, MessageEmbed } from "discord.js"

import Command from "../../utils/Command"
import client from "../../main"
import { createTable, PAD_END, PAD_START, paginator } from "../../utils/Utils"
import { BotEmoji, Character, Cost, Skill } from "../../utils/Types"
import config from "../../data/config.json"

const elementColors: Record<string, string> = {
    "Anemo": "#32D39F",
    "Wind": "#32D39F",

    "Cryo": "#79E8EB",
    "Ice": "#79E8EB",

    "Electro": "#CA7FFF",
    "Electric": "#CA7FFF",

    "Geo": "#FEE263",
    "Rock": "#FEE263",

    "Hydro": "#06E5FE",
    "Water": "#06E5FE",

    "Fire": "#FFAA6E",
    "Pyro": "#FFAA6E",

    "Dendro": "#B2EB28",
    "Grass": "#B2EB28",

    "None": "#545353",
}

export default class CharacterCommand extends Command {
    constructor(name: string) {
        super({
            name,
            category: "Character",
            usage: "character [name]",
            help: "Search for a character",
            aliases: ["characters", "cstats", "cmeta", "c", "cascension", "char"]
        })
    }

    getCharacters(page: number): MessageEmbed | undefined {
        const { data } = client
        const arti = Object.entries(data.characters)
            .reverse()
            .map(([name, info]) => `**${name}**: ${this.getElementIcons(info)} ${info.star}★ ${data.emoji(info.weaponType, true)} user`)

        const pages: string[] = []
        let paging = ""
        for (const art of arti) {
            if (paging.length + art.length > 1000) {
                pages.push(paging.trim())
                paging = art
            } else
                paging += "\n" + art
        }
        if (paging.trim().length > 0) pages.push(paging)

        if (page >= pages.length)
            return undefined

        const embed = new MessageEmbed()
            .setTitle("Character list")
            .setDescription(pages[page])
            .setFooter(`Page ${page + 1} / ${pages.length}`)
            .setColor("#00EA69")

        return embed
    }

    private getElementIcons(info: Character) {
        const { data } = client

        return info.skills.map(skill => data.emoji(skill.ult.type)).join(", ")
    }

    async run(message: Message, args: string[]): Promise<Message | Message[]> {
        const { data } = client

        if (args.length == 0) {
            const embed = this.getCharacters(0)
            if (!embed) return message.channel.send("No character data loaded")

            const reply = await message.channel.send(embed)
            await paginator(message, reply, (page) => this.getCharacters(page))
            return reply
        }

        let low = false
        let defaultPage: string | number = 0

        function addArg(queries: string | string[], exec: () => void) {
            if (typeof queries == "string")
                queries = [queries]
            for (const query of queries) {
                if (args.includes(query)) {
                    exec()
                    args.splice(args.indexOf(query), 1)
                }
            }
        }

        addArg(["-low", "-l"], () => {
            low = true
            defaultPage = 3
        })
        addArg(["-info", "-i"], () => defaultPage = 1)
        addArg(["-art", "-a"], () => defaultPage = "🎨")
        addArg(["-stats", "-asc", "-ascensions", "-ascend"], () => defaultPage = 2)
        addArg(["-books", "-talentupgrade"], () => defaultPage = 3)
        addArg(["-skill", "-skills", "-talents", "-s", "-t"], () => defaultPage = 4)
        addArg(["-const", "-constellation", "-constellations", "-c"], () => defaultPage = "🇨")

        // for MC
        addArg(["-anemo"], () => defaultPage = data.emojis.Wind)
        addArg(["-geo"], () => defaultPage = data.emojis.Rock)
        addArg(["-electro"], () => defaultPage = data.emojis.Electric)
        addArg(["-pyro"], () => defaultPage = data.emojis.Fire)
        addArg(["-dendro"], () => defaultPage = data.emojis.Grass)
        addArg(["-cryo"], () => defaultPage = data.emojis.Ice)
        addArg(["-hydro"], () => defaultPage = data.emojis.Water)

        const char = data.getCharacterByName(args.join(" "))
        if (char == undefined)
            return message.channel.send("Unable to find character")

        const charpages = this.getCharPages(char)
        const page = typeof defaultPage == "string" ? charpages[defaultPage] : defaultPage
        const embed = this.getCharacter(char, page, low)
        if (!embed) return message.channel.send("Unable to load character")

        const reply = await message.channel.send(embed)

        await paginator(message, reply, (page) => this.getCharacter(char, page, low), charpages, page)
        return reply
    }

    getCharPages(char: Character): Record<string, number> {
        const { data } = client

        const pages: Record<string, number> = {
            "📝": 0,
            "🚀": 2,
        }

        let currentPage = 4
        if (char.skills.length == 1) {
            pages[data.emojis[char.weaponType as BotEmoji] ?? "⚔️"] = currentPage

            const skills = char.skills[0]
            currentPage += skills.talents.length + 1 + skills.passive.length
            pages["🇨"] = currentPage

            currentPage += skills.constellations.length
            pages["🎨"] = currentPage
        } else {
            for (const skills of char.skills) {
                pages[data.emojis[skills.ult.type as BotEmoji] ?? "❔"] = currentPage
                currentPage += skills.talents.length + 1 + skills.passive.length + skills.constellations.length
            }
            pages["🎨"] = currentPage
        }

        return pages
    }

    getCharacter(char: Character, page: number, low: boolean): MessageEmbed | undefined {
        const { data } = client
        const embed = new MessageEmbed()
            .setColor(elementColors[char.meta.element] ?? "")
            .setThumbnail(char.icon)
            .setFooter(`Page ${page + 1} / ${this.getCharPages(char)["🎨"] + char.imgs.length}`)

        if (page == 0) {
            embed.setTitle(`${char.name}: Description`)
                .addField("Basics", `${this.getElementIcons(char)} ${char.star}★ ${data.emoji(char.weaponType, true)} user`)
                .setDescription(char.desc)

            return embed
        } else if (page == 1) {
            embed.setTitle(`${char.name}: Information`)
                .setDescription(`**Birthday**: ${char.meta.birthDay ?? "??"}/${char.meta.birthMonth ?? "??"} *(dd/mm)*
**Title**: ${char.meta.title || "-"}
**Detail**: ${char.meta.detail}

**Association**: ${char.meta.association}
**Affiliation**: ${char.meta.affiliation}
**Constellation**: ${char.meta.constellation}
**Element**: ${char.meta.element}`)
                .addField("Voice Actors", `**Chinese**: ${char.meta.cvChinese}
**Japanese**: ${char.meta.cvJapanese}
**English**: ${char.meta.cvEnglish}
**Korean**: ${char.meta.cvKorean}
`)
            return embed
        } else if (page == 2) {
            const columns: string[] = []
            const rows: string[][] = []

            const addRow = (char: Character, level: number, ascension: number) => {
                const stats = data.getCharStatsAt(char, level, ascension)
                for (const key of Object.keys(stats))
                    if (!columns.includes(key))
                        columns.push(key)

                rows.push([level.toString(), ascension.toString(), ...columns.map(c => stats[c] < 2 ? ((stats[c] * 100).toFixed(0) + "%") : stats[c].toFixed(0))])
            }

            let previousMax = 1
            for (const asc of char.ascensions) {
                addRow(char, previousMax, asc.level)
                previousMax = asc.maxLevel
                addRow(char, previousMax, asc.level)

                if (asc.cost.mora || asc.cost.items.length > 0)
                    embed.addField(`Ascension ${asc.level} costs`, this.getCosts(asc.cost), true)
            }

            embed.setTitle(`${char.name}: Ascensions + stats`)
                .setDescription("Character stats:\n```\n" + createTable(
                    ["Lvl", "Asc", ...columns.map(c => c.replace("Base", "").replace("CRIT ", "C"))],
                    rows,
                    [PAD_START]
                ) + "\n```")
            return embed
        } else if (page == 3) {
            let i = 1
            for (const cost of char.skills[0].ult.costs) {
                if (cost.mora || cost.items.length > 0)
                    embed.addField(`Talent lv ${++i} costs`, this.getCosts(cost), true)
            }

            embed.setTitle(`${char.name}: Talent upgrade costs`)
            return embed
        }

        function showTalent(skill: Skill): void {
            embed.setTitle(`${char.name}: ${skill.name}`)
                .setDescription(skill.desc)

            if (skill.charges > 1)
                embed.addField("Charges", skill.charges)

            let hasLevels = false
            for (const { name, values } of skill.talentTable) {
                if (values.filter(k => k != values[0]).length > 0) {
                    hasLevels= true
                    embed.addField(name, "```\n"+ createTable(
                        undefined,
                        Object.entries(values)
                            .map(([lv, val]) => [+lv + 1, val])
                            .filter(([lv]) => (low ? lv <= 6 : lv >= 6) && lv <= 13),
                        [PAD_START, PAD_END]
                    ) + "\n```", true)
                } else
                    embed.addField(name, values[0], true)
            }
            if (skill.type)
                embed.addField("Element type", skill.type, true)
            if (hasLevels)
                embed.setFooter(`${embed.footer?.text} - Use '${config.prefix}c ${char.name}${low ? "' to display higher" : " -low' to display lower"} levels`)
        }

        let currentPage = 4
        for (const skills of char.skills) {
            embed.setColor(elementColors[skills.ult.type ?? "None"])

            for (const talent of skills.talents) {
                if (currentPage++ == page) {
                    showTalent(talent)
                    return embed
                }
            }

            if (currentPage++ == page) {
                showTalent(skills.ult)
                return embed
            }

            for (const passive of skills.passive) {
                if (currentPage++ == page) {
                    embed.setTitle(`${char.name}: ${passive.name}`)
                        .setDescription(passive.desc)
                        .addField("Unlocked by", passive.minAscension ? `Ascension ${passive.minAscension}` : "Unlocked by default")
                    return embed
                }
            }

            let c = 0
            for (const constellation of skills.constellations) {
                c++
                if (currentPage++ == page) {
                    embed.setTitle(`${char.name} C${c}: ${constellation.name}`)
                        .setThumbnail(constellation.icon)
                        .setDescription(constellation.desc)
                    return embed
                }
            }
        }

        const offset = page - currentPage
        if (offset >= 0 && offset < char.imgs.length) {
            const img = char.imgs[offset]
            embed.setTitle(`${char.name}`)
                .setDescription(`[Open image in browser](${img})`)
                .setImage(img)
            embed.thumbnail = null
            return embed
        }

        return undefined
    }

    private getCosts(cost: Cost): string {
        return `**${cost.mora}**x *Mora*\n${cost.items.map(i => `**${i.count}**x *${i.name}*`).join("\n")}`
    }
}
