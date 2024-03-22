Reference video: https://www.youtube.com/watch?v=EUlnKW6Yy94

NPM Version: 10.2.4

Node Version: 20.10.0

## Dev Commands

| Command                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| npm run deploy            | Deploys all commands found in `src/commands` |
| npm run delete            | Deletes all guild and global commands        |
| npm run generate 'prompt' | Generates an image with DALL-E               |

## CLI Setup

### Bepo v1: Installation

```sh
Clone repo
cd /path/to/bepo
Set up db connections with guild and command tables -> npm install -g @supabase/cli
Set enviroment variables (.env)

In the CLI:
npm run deploy -> Sets all the commands 
npm start -> Runs Bepo
```

