import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homepage = readFileSync(new URL('../docs/index.md', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../docs/.vitepress/theme/style.css', import.meta.url), 'utf8')
const config = readFileSync(new URL('../docs/.vitepress/config.ts', import.meta.url), 'utf8')

assert.doesNotMatch(homepage, /^hero:/m, 'stock VitePress hero should be removed')
assert.doesNotMatch(homepage, /^features:/m, 'stock feature cards should be removed')
assert.doesNotMatch(homepage, /推荐阅读路径/, 'reading path section should stay removed')
assert.match(homepage, /class="obsidian-home"/, 'custom homepage shell is required')
assert.match(homepage, /class="profile-panel"/, 'profile sidebar is required')
assert.match(homepage, /src="\/logo\.png"/, 'existing logo must remain visible')
assert.match(homepage, /class="home-feed"/, 'article feed is required')
assert.match(homepage, /class="featured-story"/, 'featured story is required')
assert.match(homepage, /rocketmq-vs-kafka/, 'messaging article must remain linked')
assert.match(homepage, /g1-vs-zgc/, 'JVM article must remain linked')
assert.match(homepage, /class="topic-directory"/, 'topic directory is required')

assert.match(styles, /\.obsidian-home\s*\{/, 'homepage styles must be scoped')
assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*320px\)\s+minmax\(0,\s*1fr\)/, 'desktop two-column layout is required')
assert.match(styles, /position:\s*sticky/, 'desktop profile panel must be sticky')
assert.match(styles, /@media\s*\(max-width:\s*760px\)/, 'mobile breakpoint is required')
assert.match(config, /appearance:\s*'force-dark'/, 'the site must force dark appearance without a theme toggle')

console.log('Homepage structure checks passed.')
