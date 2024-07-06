// deno-lint-ignore-file no-explicit-any

import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { OpenAI } from "npm:openai"
const __dirname = path.dirname(new URL(import.meta.url).pathname)
import chalk from "npm:chalk"
import dotenv from "npm:dotenv"
import { type CreativeVideoEditorArgs, creative_video_creator } from "./tools.ts"
dotenv.config()

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!
const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID")!
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!
// const ELEVENLABS_CHUNK_SIZE = "1024"

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set")
if (!ELEVENLABS_VOICE_ID) throw new Error("ELEVENLABS_VOICE_ID is not set")
if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set")

export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
})

type ChalkColor = "red" | "green" | "yellow" | "blue" | "magenta" | "cyan"
export function log(color: ChalkColor, ...message: string[]) {
    console.log((chalk as any)[color](...message))
}

export async function clear() {
    await new Promise(resolve => {
        spawn(process.platform === "win32" ? "cls" : "clear", { stdio: "inherit" }).on("exit", resolve)
    })
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type Model = "gpt-3.5-turbo-0125" | "gpt-3.5-turbo-instruct" | "gpt-4-0125-preview" | "gpt-4-turbo-2024-04-09" | "gpt-4o"

type PricingTable = {
    [K in Model]: {
        input: number
        output: number
    }
}

export const costs: PricingTable = {
    "gpt-3.5-turbo-0125": {
        input: 0.5 / 1_000_000,
        output: 1.5 / 1_000_000
    },
    "gpt-3.5-turbo-instruct": {
        input: 1.5 / 1_000_000,
        output: 2.5 / 1_000_000
    },
    "gpt-4-0125-preview": {
        input: 10 / 1_000_000,
        output: 30 / 1_000_000
    },
    "gpt-4-turbo-2024-04-09": {
        input: 10 / 1_000_000,
        output: 30 / 1_000_000
    },
    "gpt-4o": {
        input: 5 / 1_000_000,
        output: 15 / 1_000_000
    }
}

/** Calculate the cost of using an OpenAI model. */
export function whatsTheDamage({ model, inputTokens, outputTokens }: { model: Model; inputTokens: number; outputTokens: number }) {
    if (!model) throw new Error("model is required")
    if (!inputTokens) throw new Error("inputTokens is required")
    if (!outputTokens) throw new Error("outputTokens is required")
    // console.log(`model: ${model}, inputTokens: ${inputTokens}, outputTokens: ${outputTokens}`)
    return costs[model].input * inputTokens + costs[model].output * outputTokens
}

type AssistParams = {
    model: Model
    prompt?: string
    instructions?: string
    tools?: any[]
    thread_id?: string
    assistant_id?: string
    assistant_name?: string
    response_format?: "auto" | { type: "text" } | { type: "json_object" }
}

/** Spin up an assistant and ask it a question. Create a new assistant, or update the instructions of an existing assistant. Or just use an existing assistant. */
export async function assist({ model, prompt, instructions, tools, thread_id, assistant_id = process.env.ASSISTANT_ID, assistant_name = `assistant-${Math.floor(Date.now() / 1000)}`, response_format }: AssistParams) {
    if (!(model in costs)) throw new Error("Invalid model")
    if (!tools) tools = [creative_video_creator]

    const session: any = { thread_id: null, cost: 0, input_tokens: 0, output_tokens: 0 }

    if (instructions) {
        if (assistant_id) {
            await openai.beta.assistants.update(assistant_id, { instructions })
        } else {
            if (!model) throw new Error("model is required")
            const assistant = await openai.beta.assistants.create({ model, instructions, name: assistant_name, tools })
            assistant_id = assistant.id
        }
    }

    if (!assistant_id) throw new Error("assistant_id is required")

    let run
    if (thread_id) {
        await openai.beta.threads.messages.create(thread_id, { role: "user", content: prompt! })
        run = await openai.beta.threads.runs.create(thread_id, { assistant_id, tools: tools, response_format })
    } else {
        if (!model || !prompt) throw new Error("model and prompt are required")
        run = await openai.beta.threads.createAndRun({
            model,
            tools: tools,
            assistant_id,
            thread: { messages: [{ role: "user", content: prompt }] },
            response_format
        })
    }

    const outputs: any[] = []
    while (run.status !== "completed") {
        await new Promise(resolve => setTimeout(resolve, 1000))
        run = await openai.beta.threads.runs.retrieve(run.thread_id, run.id)

        if (run.status === "requires_action" && run.required_action) {
            const tool_outputs = await Promise.all(
                run.required_action.submit_tool_outputs.tool_calls.map(async tool_call => {
                    const args = JSON.parse(tool_call.function.arguments)
                    let output

                    if (tool_call.function.name === "creative_video_creator") {
                        output = await creativeVideoCreator(args)
                    } else {
                        console.log(`Unknown tool: ${tool_call.function.name}`)
                        output = { success: true }
                    }

                    outputs.push(output)
                    return { tool_call_id: tool_call.id, output: JSON.stringify(output) }
                })
            )

            run = await openai.beta.threads.runs.submitToolOutputs(run.thread_id, run.id, { tool_outputs })
        }
    }

    const messages = await openai.beta.threads.messages.list(run.thread_id)
    // @ts-ignore: I'm sure `text` exists
    const reply = messages.data[0].content[0].text.value
    session.thread_id = run.thread_id
    session.cost += whatsTheDamage({ model, inputTokens: run.usage!.prompt_tokens, outputTokens: run.usage!.completion_tokens })
    session.input_tokens += run.usage!.prompt_tokens
    session.output_tokens += run.usage!.completion_tokens

    return { reply, session, outputs }
}

async function creativeVideoCreator(_args: CreativeVideoEditorArgs) {
    await new Promise(resolve => setTimeout(resolve, 10))
    return "not available"
}

type TextToSpeechInput = {
    text: string
    similarityBoost?: number
    stability?: number
    style?: number
    useSpeakerBoost?: boolean
    voiceId?: string
}

export async function textToSpeech({ text, similarityBoost = 0.5, stability = 0.5, style = 0.4, useSpeakerBoost = true, voiceId = ELEVENLABS_VOICE_ID }: TextToSpeechInput) {
    console.log("> elevenlabs processing started")

    let wait = 2000
    let response

    while (true) {
        try {
            response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {
                    Accept: "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": ELEVENLABS_API_KEY
                },
                body: JSON.stringify({
                    model_id: "eleven_english_v2",
                    text: text,
                    voice_settings: {
                        similarity_boost: similarityBoost,
                        stability: stability,
                        use_speaker_boost: useSpeakerBoost,
                        style: style
                    }
                })
            })

            if (response.status === 429) {
                wait *= 2
                if (wait > 600000) throw new Error("> server busy for too long, aborted after 10 minutes")
                console.log(`> server busy, waiting ${wait / 1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, wait))
                continue
            }

            if (response.ok) break
            if (!response.ok) throw new Error(`HTTP error! status: ${await response.text()}`)
        } catch (error) {
            throw error
        }
    }

    const audioFilename = `speech___${text
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .split(" ")
        .slice(0, 6)
        .join("_")}.mp3`

    // const chunkSize = Number.parseInt(ELEVENLABS_CHUNK_SIZE || "1024")
    try {
        const mp3Buffer = await response.arrayBuffer()
        fs.writeFileSync(audioFilename, new Uint8Array(mp3Buffer))
    } catch (error) {
        throw error
    }

    const encodedPath = path.basename(audioFilename, path.extname(audioFilename)) + "_fixed.mp3"
    await new Promise((resolve, reject) => {
        spawn("ffmpeg", ["-i", audioFilename, "-acodec", "libmp3lame", "-b:a", "128k", encodedPath])
            .on("close", code => {
                if (code === 0) resolve(0)
                else reject(new Error(`FFmpeg process exited with code ${code}`))
            })
            .on("error", reject)
    }).catch(error => {
        throw error
    })

    console.log(`> ${encodedPath} created`)
    return encodedPath
}

type SunoApiCustomGenerateBody = {
    prompt: string // lyrics
    tags: string
    title: string
    make_instrumental: boolean
    wait_audio: true
}

type SunoApiCustomGenerateJsonResponse = {
    id: string
    title: string
    image_url: string
    lyric: string
    audio_url: string
    video_url: string
    created_at: string
    model_name: string
    status: string
    gpt_description_prompt: string
    prompt: string
    type: string
    tags: string
}[]

type TextToMusicInput = {
    text: string
    lyrics?: string
    instrumental: boolean
    writeFile: boolean
    nResults?: 1 | 2
}

export async function textToMusic({ text, lyrics, instrumental = true, writeFile = false, nResults = 1 }: TextToMusicInput) {
    
    let prompt, tags, title
    const make_instrumental = instrumental
    const wait_audio = true

    if (instrumental) {
        prompt = " "
        tags = text
        title = text
    } else if (!lyrics) {
        const { reply } = await assist({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            instructions: "You are a creative musician trained on all of music history. Help the user create music with whatever vibes/lyrics they ask for! Remember, the maximum song length is 3 minutes, so keep the lyrics to a handful of sentences. Also, try to keep the vibe and mood to under one sentence each. The title should be 5 words or less. Remember, the lyrics should be really weird and borderline crazy. Don't go simple on the lyrics, make them memorable because of how wild they are!",
            prompt: `Return a { lyrics, vibe, mood, title } JSON object based on the user's input: "${text}"`
        }) 
        const { lyrics, vibe, mood, title: t } = JSON.parse(reply)
        prompt = lyrics
        tags = [vibe, mood].join(", ")
        title = t
    } else {
        prompt = lyrics
        tags = text
        title = text
    }

    const endpoint = "https://suno-api-mocha-delta.vercel.app"
    const [{ audio_url }] = await new Promise<SunoApiCustomGenerateJsonResponse>((resolve, reject) => {
        fetch(`${endpoint}/api/custom_generate`, {
            method: "POST",
            body: JSON.stringify({
                prompt,
                tags,
                title,
                make_instrumental,
                wait_audio
            } as SunoApiCustomGenerateBody),
            headers: { "Content-Type": "application/json" }
        })
            .then(response => response.json())
            .then(json => {
                resolve(json)
                console.log(json)
            })
            .catch(reject)
    })

    if (writeFile) log("yellow", "TODO: Oops! File writing is not implemented...")
    return audio_url
}