# Demo website

This is the exact frontend used at
[https://die-in-browser.deno.dev](https://die-in-browser.deno.dev).

**All analysis happens locally in your browser — no files are ever sent to a
server.**

To run this demo locally, your directory must contain the following files:

- `libv86.js`
- `die.js`
- `v86.wasm`
- `seabios.bin`
- `vgabios.bin`
- `v86state.bin.zst`

> 💡 These files are placed in the same directory as `index.html`.

## How to Run

The easiest way to run this demo is to serve it with a local HTTP server:

```bash
npx serve
```
