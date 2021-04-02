import log4js from "log4js"
import { exists, unlink, move, writeFile, existsSync, readFileSync } from "fs-extra"
import { join } from "path"

import { Artifact, ArtifactType, MainStatInfo, Character, BotEmoji, Store } from "./Types"

import artifactsData from "../data/gamedata/artifacts.json"
import artifactsMainStats from "../data/gamedata/artifact_main_stats.json"
import artifactsMainLevels from "../data/gamedata/artifact_main_levels.json"

import characterData from "../data/gamedata/characters.json"
import curves from "../data/gamedata/curves.json"

import emojiData from "../data/emojis.json"

import { findFuzzy } from "./Utils"

const Logger = log4js.getLogger("DataManager")
const existsP = (path: string): Promise<boolean> => new Promise((resolve) => exists(path, resolve))

const path = join(__dirname, "../../src/data/")
const store = join(path, "store.json")
const oldstore = join(path, "store.json.old")
const defaultStore: Store = {}

export default class DataManager {
    store: Store = defaultStore

    readonly max_resin = 160
    readonly minutes_per_resin = 8

    readonly artifacts: Record<string, Artifact> = artifactsData as Record<string, Artifact>
    readonly artifactMainStats: Record<ArtifactType, MainStatInfo[]> = artifactsMainStats as Record<ArtifactType, MainStatInfo[]>
    readonly artifactMainLevels: Record<string, Record<number, Record<number, string>>> = artifactsMainLevels as Record<string, Record<number, Record<number, string>>>

    readonly characters: Record<string, Character> = characterData as Record<string, Character>

    readonly emojis: Record<BotEmoji, string> = emojiData

    constructor() {
        try {
            if (existsSync(store))
                try {
                    this.store = Object.assign({}, defaultStore, JSON.parse(readFileSync(store).toString()))
                    return
                } catch (error) {
                    Logger.error("Failed to read/parse store.json")
                }

            if (existsSync(oldstore))
                try {
                    this.store = Object.assign({}, defaultStore, JSON.parse(readFileSync(oldstore).toString()))
                    Logger.error("Restored from old store!")
                    return
                } catch (error) {
                    Logger.error("Failed to read/parse store.json.old")
                }

            // writeFileSync(store, JSON.stringify(this.store))
        } catch (error) {
            Logger.error("Failed to open store.json", error)
        }
    }

    lastStore: number | NodeJS.Timeout | undefined = undefined
    saveStore(): void {
        if (this.lastStore == undefined) {
            this.lastStore = setTimeout(async () => {
                try {
                    if (await existsP(oldstore))
                        await unlink(oldstore)

                    if (await existsP(store))
                        await move(store, oldstore)

                    await writeFile(store, JSON.stringify(this.store, undefined, 4))
                } catch (error) {
                    Logger.error("Failed to save", error)
                }
                this.lastStore = undefined
            }, 1000)
        }
    }

    emoji(type: string | undefined, includeName = false): string {
        if (!type)
            return type ?? "Unknown"

        const found = this.emojis[type as BotEmoji]
        if (!found) return type
        if (includeName) return `${found} ${type}`
        return found
    }

    getArtifactByName(name: string): Artifact | undefined {
        const targetNames = Object.keys(this.artifacts)
        const target = findFuzzy(targetNames, name)

        if (target)
            return this.artifacts[target]

        return undefined
    }

    getCharacterByName(name: string): Character | undefined {
        const targetNames = Object.keys(this.characters)
        const target = findFuzzy(targetNames, name)

        if (target)
            return this.characters[target]

        return undefined
    }

    getCharStatsAt(char: Character, level: number, ascension: number): Record<string, number> {
        const stats: Record<string, number> = {
            "Base HP": char.hpBase,
            "Base ATK": char.attackBase,
            "Base DEF": char.defenseBase,
            "CRIT Rate": char.criticalBase,
            "CRIT DMG": char.criticalHurtBase,
        }

        for (const curve of char.curves) {
            stats[curve.name] = stats[curve.name] * curves[curve.curve][level - 1]
        }

        const asc = char.ascensions.find(a => a.level == ascension)

        for (const statup of asc?.statsup ?? []) {
            stats[statup.stat] = (stats[statup.stat] ?? 0) + statup.value
        }

        return stats
    }
}
