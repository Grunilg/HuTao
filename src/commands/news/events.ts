import { Message, MessageEmbed } from "discord.js"

import Command from "../../utils/Command"
import client from "../../main"
import { Bookmarkable, Colors, getDate, getEventEmbed, paginator } from "../../utils/Utils"
import { Event } from "../../utils/Types"

export default class Events extends Command {
    constructor(name: string) {
        super({
            name,
            category: "News",
            usage: "events",
            help: "List upcoming and ongoing events",
            aliases: ["e"]
        })
    }

    async run(message: Message): Promise<Message | Message[] | undefined> {
        const now = Date.now()
        const { events } = client.data

        const ongoing = events
            .filter(e =>
                e.start &&
                getDate(e.start, e.timezone).getTime() <= now &&
                (
                    (e.end && getDate(e.end, e.timezone).getTime() >= now) ||
                    (!e.end && e.reminder == "daily")
                )
            ).sort((a, b) => {
                if (!a.end) return 1
                if (!b.end) return -1
                return getDate(a.end, a.timezone).getTime() - getDate(b.end, b.timezone).getTime()
            })

        const upcoming = events
            .filter(e => e.start == undefined || getDate(e.start, e.timezone).getTime() > now)
            .sort((a, b) => {
                if (!a.start) return 1
                if (!b.start) return -1
                return getDate(a.start, a.timezone).getTime() - getDate(b.start, b.timezone).getTime()
            })

        const summaryPages = this.getSummaryPages(ongoing, upcoming)
        const pages: Bookmarkable[] = [{
            bookmarkEmoji: "",
            bookmarkName: "Ongoing",
            invisible: true,
            maxPages: ongoing.length,
            pages: (rp, cp, mp) => this.getOngoingEvent(ongoing, rp, cp, mp)
        }, {
            bookmarkEmoji: "",
            bookmarkName: "Summary",
            invisible: true,
            maxPages: summaryPages.length,
            pages: (rp, cp, mp) => this.getSummary(summaryPages, rp, cp, mp)
        }, {
            bookmarkEmoji: "",
            bookmarkName: "Upcoming",
            invisible: true,
            maxPages: upcoming.length,
            pages: (rp, cp, mp) => this.getUpcomingEvent(upcoming, rp, cp, mp)
        }]

        await paginator(message,  pages, "Summary")
        return undefined
    }

    getOngoingEvent(ongoing: Event[], relativePage: number, currentPage: number, maxPages: number): MessageEmbed | undefined {
        const event = ongoing[ongoing.length - relativePage - 1]
        if (event == undefined) return undefined

        const embed = getEventEmbed(event)
            .setFooter(`Page ${currentPage} / ${maxPages}`)
            .setColor("#F49C1F")

        if (event.end)
            embed.setTimestamp(getDate(event.end, event.timezone))

        return embed
    }

    getUpcomingEvent(upcoming: Event[], relativePage: number, currentPage: number, maxPages: number): MessageEmbed | undefined {
        const event = upcoming[relativePage]
        if (event == undefined) return undefined

        const embed = getEventEmbed(event)
            .setFooter(`Page ${currentPage} / ${maxPages}`)
            .setColor("#F4231F")

        if (event.start)
            embed.setTimestamp(getDate(event.start, event.timezone))

        return embed
    }

    getSummary(pages: MessageEmbed[], relativePage: number, currentPage: number, maxPages: number): MessageEmbed | undefined {
        return pages[relativePage]
            .setTitle("Events")
            .setFooter(`Page ${currentPage} / ${maxPages}`)
            .setColor(Colors.DARK_GREEN)
    }

    getSummaryPages(ongoing: Event[], upcoming: Event[]): MessageEmbed[] {
        const pages: MessageEmbed[] = []
        const curr = ongoing
            .map(e =>
                `${e.end ? `Ending on ${e.end}${e.timezone?` (GMT${e.timezone})`:""}` : "Ongoing"}: ${e.link ? `[${e.name}](${e.link}) ` : e.name}`
            )
        const next = upcoming
            .map(e =>
                `${e.type == "Unlock" ? "Unlocks at" : "Starting on"} ${e.prediction ? "*(prediction)* " : ""}${e.start ? e.start : "????"}${e.timezone?` (GMT${e.timezone})`:""}: ${e.link ? `[${e.name}](${e.link})` : e.name}`
            )

        let currentEmbed = new MessageEmbed(), currLine = "", nextLine = ""
        while (curr.length > 0) {
            const newCurr = curr.shift()
            if (newCurr == undefined) break
            if (currLine.length + newCurr.length > 800 && currLine.length > 0) {
                currentEmbed.addField("Current Events", currLine + "***See next page for more***")
                pages.push(currentEmbed)
                currentEmbed = new MessageEmbed()
                currLine = ""
            }
            currLine += newCurr + "\n"
        }
        if (currLine.length > 0)
            currentEmbed.addField("Current Events", currLine.trim())
        if (ongoing.length == 0)
            currentEmbed.addField("Current Events", "None")

        while (next.length > 0) {
            const newNext = next.shift()
            if (newNext == undefined) break
            if (nextLine.length + newNext.length > 800 && nextLine.length > 0) {
                currentEmbed.addField("Upcoming Events", nextLine + "***See next page for more***")
                pages.push(currentEmbed)
                currentEmbed = new MessageEmbed()
                nextLine = ""
            }
            nextLine += newNext + "\n"
        }
        if (nextLine.length > 0) {
            currentEmbed.addField("Upcoming Events", nextLine.trim())
            pages.push(currentEmbed)
        }
        if (upcoming.length == 0) {
            currentEmbed.addField("Upcoming Events", "None")
            pages.push(currentEmbed)
        }

        return pages
    }
}
