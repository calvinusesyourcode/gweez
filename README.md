# music gen

# setup
clone repo
```
git clone https://github.com/calvinusesyourcode/gweez musicgen
cd musicgen
```
install [deno](https://docs.deno.com/runtime/manual/getting_started/installation/) (if not already installed) (below command is macOS) 
```
curl -fsSL https://deno.land/install.sh | sh
```
create .env file with the necessary variables
```
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```
run and have fun
```
deno run --allow-env --allow-ffi --allow-read --allow-write --allow-net --allow-run test.ts
```
