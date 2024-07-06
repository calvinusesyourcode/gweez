import { textToMusic, clear, log } from "./helpers.ts"
await clear()

//

const text = "silly water temple underwater videogame OST"
const instrumental = true

//
//
//

log("cyan", `> Composing ${instrumental ? "an instrumental OST" : "a song"} inspired by "${text}"`)
const result = await textToMusic({
    text,
    instrumental,
    writeFile: true
})
console.log(result)
log("blue", `> Ready for listening!`)
