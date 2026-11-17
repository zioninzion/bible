# Bible RcV

A static Bible reader with a responsive book library and reading view.

Serve the repository over HTTP for local development:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 to go directly to the Bible reader. Deployments can
use any hostname or subdirectory. HTTPS (or localhost) is required for service
workers. Pages visited online are cached for later offline use; the entire Bible
is not downloaded automatically.

Run the runtime regression checks with Node.js:

```sh
node --test tests/runtime.cjs
```
